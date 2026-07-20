import type { AppSyncIdentityCognito } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/refresh-access-token";
import type { Schema } from "../../data/resource";
import {
    requestHmrcToken,
    tokenMetadata,
} from "../shared/hmrc-oauth";
import type { HmrcOAuthError } from "../shared/hmrc-oauth.types";
import {
    getStoredHmrcRefreshToken,
    HmrcTokenStoreError,
    persistHmrcTokens,
} from "../shared/persist-hmrc-tokens";
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

export const handler: Schema["refreshAccessToken"]["functionHandler"] = async (event) => {
    const identity = event.identity as AppSyncIdentityCognito;
    let refreshToken: string;

    try {
        refreshToken = await getStoredHmrcRefreshToken(client, identity);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await writeAuditLog(identity, {
            eventType: "HMRC_REFRESH_TOKEN_EXCHANGE",
            outcome: "FAILED",
            errorMessage: message,
        });
        const tokenStoreError = error instanceof HmrcTokenStoreError
            ? error
            : undefined;
        return failure({
            statusCode: tokenStoreError?.statusCode ?? 500,
            error: tokenStoreError?.code ?? "token_storage_failed",
            errorDescription: tokenStoreError?.message
                ?? "Unable to read the stored HMRC refresh token",
        });
    }

    const tokenResult = await requestHmrcToken({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });

    if (!tokenResult.ok) {
        await writeAuditLog(identity, {
            eventType: "HMRC_REFRESH_TOKEN_EXCHANGE",
            outcome: "FAILED",
            errorMessage: tokenResult.error.errorDescription,
        });
        return failure(tokenResult.error);
    }

    try {
        await persistHmrcTokens(client, identity, tokenResult.tokens);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await writeAuditLog(identity, {
            eventType: "HMRC_REFRESH_TOKEN_EXCHANGE",
            outcome: "FAILED",
            errorMessage: message,
        });
        return failure({
            statusCode: 500,
            error: "token_storage_failed",
            errorDescription: "Unable to store the refreshed HMRC tokens",
        });
    }

    await writeAuditLog(identity, {
        eventType: "HMRC_REFRESH_TOKEN_EXCHANGE",
        outcome: "SUCCEEDED",
        tokens: tokenResult.tokens,
    });

    return {
        success: true,
        token: tokenMetadata(tokenResult.tokens),
    };
};
