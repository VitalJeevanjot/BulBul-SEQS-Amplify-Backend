import type { AppSyncIdentityCognito, AppSyncResolverHandler } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/change-to-access-token";
import type { Schema } from "../../data/resource";
import {
    requestHmrcToken,
    type HmrcTokenResponse,
} from "../shared/hmrc-oauth";
import { persistHmrcTokens } from "../shared/persist-hmrc-tokens";
import { writeHmrcOAuthAuditLog } from "../shared/write-hmrc-oauth-audit-log";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

export const handler: AppSyncResolverHandler<
    { input: string; stateId: string },
    boolean
> = async (event) => {
    const { input: authorizationCode, stateId } = event.arguments;
    const identity = event.identity as AppSyncIdentityCognito;

    if (!stateId.trim() || stateId.length > 256) {
        throw new Error("A valid OAuth state ID is required");
    }

    let tokens: HmrcTokenResponse;

    try {
        tokens = await requestHmrcToken({
            grant_type: "authorization_code",
            code: authorizationCode,
            redirect_uri: env.HMRC_REDIRECT_URI,
        });

        await persistHmrcTokens(client, identity, tokens);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";

        await writeHmrcOAuthAuditLog(
            client,
            identity,
            {
                eventType: "HMRC_AUTHORIZATION_CODE_EXCHANGE",
                outcome: "FAILED",
                stateId,
                errorMessage: message,
            },
        );
        throw error;
    }

    await writeHmrcOAuthAuditLog(client, identity, {
        eventType: "HMRC_AUTHORIZATION_CODE_EXCHANGE",
        outcome: "SUCCEEDED",
        stateId,
        tokens,
    });
    return true;
};
