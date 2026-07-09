import type { AppSyncIdentityCognito } from "aws-lambda";
import type { HmrcTokenResponse } from "./hmrc-oauth";

type UserDataClient = {
    models: {
        UserData: {
            get(input: { id: string }): Promise<{
                data?: { id: string; refreshToken?: string | null } | null;
                errors?: readonly unknown[];
            }>;
            create(input: Record<string, unknown>): Promise<{
                errors?: readonly unknown[];
            }>;
            update(input: Record<string, unknown>): Promise<{
                errors?: readonly unknown[];
            }>;
        };
    };
};

const throwOnDataErrors = (
    operation: string,
    errors?: readonly unknown[],
): void => {
    if (errors?.length) {
        throw new Error(`Unable to ${operation} the user's HMRC tokens`);
    }
};

export const getStoredHmrcRefreshToken = async (
    client: UserDataClient,
    identity: AppSyncIdentityCognito | null | undefined,
): Promise<string> => {
    if (!identity?.sub) {
        throw new Error("A Cognito user identity is required");
    }

    const existing = await client.models.UserData.get({ id: identity.sub });
    throwOnDataErrors("read", existing.errors);

    if (!existing.data?.refreshToken) {
        throw new Error("No HMRC refresh token is available for this user");
    }

    return existing.data.refreshToken;
};

export const persistHmrcTokens = async (
    client: UserDataClient,
    identity: AppSyncIdentityCognito | null | undefined,
    tokens: HmrcTokenResponse,
): Promise<void> => {
    if (!identity?.sub || !identity.username) {
        throw new Error("A Cognito user identity is required");
    }

    const id = identity.sub;
    const tokenDataWithoutScope = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt: new Date(
            Date.now() + tokens.expires_in * 1000,
        ).toISOString(),
        tokenType: tokens.token_type,
    };
    const tokenDataWithScope = {
        ...tokenDataWithoutScope,
        scope: tokens.scope,
    };
    const tokenData = tokens.scope === undefined
        ? tokenDataWithoutScope
        : tokenDataWithScope;
    const existing = await client.models.UserData.get({ id });

    throwOnDataErrors("read", existing.errors);

    if (existing.data) {
        const updated = await client.models.UserData.update({
            ...tokenData,
            id,
        });
        throwOnDataErrors("update", updated.errors);
        return;
    }

    const created = await client.models.UserData.create({
        username: identity.username,
        ...tokenData,
        id,
    });
    throwOnDataErrors("create", created.errors);
};
