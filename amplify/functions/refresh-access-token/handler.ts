import type { AppSyncIdentityCognito, AppSyncResolverHandler } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/refresh-access-token";
import type { Schema } from "../../data/resource";
import {
    requestHmrcToken,
    type HmrcTokenResponse,
} from "../shared/hmrc-oauth";
import {
    getStoredHmrcRefreshToken,
    persistHmrcTokens,
} from "../shared/persist-hmrc-tokens";
import { writeHmrcOAuthAuditLog } from "../shared/write-hmrc-oauth-audit-log";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

export const handler: AppSyncResolverHandler<Record<string, never>, boolean> = async (event) => {
    const identity = event.identity as AppSyncIdentityCognito;
    let tokens: HmrcTokenResponse;

    try {
        const refreshToken = await getStoredHmrcRefreshToken(client, identity);
        tokens = await requestHmrcToken({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        });

        await persistHmrcTokens(client, identity, tokens);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";

        await writeHmrcOAuthAuditLog(client, identity, {
            eventType: "HMRC_REFRESH_TOKEN_EXCHANGE",
            outcome: "FAILED",
            errorMessage: message,
        });
        throw error;
    }

    await writeHmrcOAuthAuditLog(client, identity, {
        eventType: "HMRC_REFRESH_TOKEN_EXCHANGE",
        outcome: "SUCCEEDED",
        tokens,
    });
    return true;
};
