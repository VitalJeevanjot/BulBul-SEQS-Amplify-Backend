import type { AppSyncIdentityCognito } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/change-to-access-token";
import type { Schema } from "../../data/resource";
import {
    requestHmrcToken,
    tokenMetadata,
} from "../shared/hmrc-oauth";
import type { HmrcOAuthError } from "../shared/hmrc-oauth.types";
import { persistHmrcTokens } from "../shared/persist-hmrc-tokens";
import { writeHmrcOAuthAuditLog } from "../shared/write-hmrc-oauth-audit-log";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

const writeAuditLog = async (
    identity: AppSyncIdentityCognito,
    entry: Parameters<typeof writeHmrcOAuthAuditLog>[2],
): Promise<void> => {
    try {
        await writeHmrcOAuthAuditLog(client, identity, entry);
    } catch (error) {
        console.error("Unable to write HMRC OAuth audit log", error);
    }
};

const failure = (error: HmrcOAuthError) => ({
    success: false as const,
    error,
});

export const handler: Schema["changeToAccessToken"]["functionHandler"] = async (event) => {
    const { input: authorizationCode, stateId } = event.arguments;
    const identity = event.identity as AppSyncIdentityCognito;

    if (!stateId.trim() || stateId.length > 256) {
        return failure({
            statusCode: 400,
            error: "invalid_request",
            errorDescription: "A valid OAuth state ID is required",
        });
    }

    if (!authorizationCode.trim()) {
        return failure({
            statusCode: 400,
            error: "invalid_request",
            errorDescription: "An authorization code is required",
        });
    }

    const tokenResult = await requestHmrcToken({
        grant_type: "authorization_code",
        code: authorizationCode,
        redirect_uri: env.HMRC_REDIRECT_URI,
    });

    if (!tokenResult.ok) {
        await writeAuditLog(identity, {
            eventType: "HMRC_AUTHORIZATION_CODE_EXCHANGE",
            outcome: "FAILED",
            stateId,
            errorMessage: tokenResult.error.errorDescription,
        });
        return failure(tokenResult.error);
    }

    try {
        await persistHmrcTokens(client, identity, tokenResult.tokens);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await writeAuditLog(identity, {
            eventType: "HMRC_AUTHORIZATION_CODE_EXCHANGE",
            outcome: "FAILED",
            stateId,
            errorMessage: message,
        });
        return failure({
            statusCode: 500,
            error: "token_storage_failed",
            errorDescription: "Unable to store the HMRC authorization tokens",
        });
    }

    await writeAuditLog(identity, {
        eventType: "HMRC_AUTHORIZATION_CODE_EXCHANGE",
        outcome: "SUCCEEDED",
        stateId,
        tokens: tokenResult.tokens,
    });

    return {
        success: true,
        token: tokenMetadata(tokenResult.tokens),
    };
};
