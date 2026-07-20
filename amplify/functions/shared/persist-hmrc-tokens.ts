import type { AppSyncIdentityCognito } from "aws-lambda";
import {
    requestHmrcToken,
} from "./hmrc-oauth";
import type { HmrcTokenResponse } from "./hmrc-oauth.types";
import type {
    GetStoredHmrcAccessTokenOptions,
    HmrcTokenStatus,
    HmrcTokenStoreErrorCode,
    StoredUserData,
    UserDataClient,
} from "./persist-hmrc-tokens.types";

const ACCESS_TOKEN_EXPIRATION_LEEWAY_MS = 60_000;

export class HmrcTokenStoreError extends Error {
    readonly statusCode: number;
    readonly code: HmrcTokenStoreErrorCode;

    constructor(
        statusCode: number,
        code: HmrcTokenStoreErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "HmrcTokenStoreError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

const throwOnDataErrors = (
    operation: string,
    errors?: readonly unknown[],
): void => {
    if (errors?.length) {
        throw new HmrcTokenStoreError(
            500,
            "token_storage_failed",
            `Unable to ${operation} the user's HMRC tokens`,
        );
    }
};

const hasStoredToken = (token: string | null | undefined): boolean =>
    Boolean(token?.trim());

export const hasStoredHmrcAccessToken = (
    userData: StoredUserData | null | undefined,
): boolean => hasStoredToken(userData?.accessToken);

export const hasStoredHmrcRefreshToken = (
    userData: StoredUserData | null | undefined,
): boolean => hasStoredToken(userData?.refreshToken);

export const getStoredHmrcTokenStatus = async (
    client: UserDataClient,
    identity: AppSyncIdentityCognito | null | undefined,
): Promise<HmrcTokenStatus> => {
    if (!identity?.sub) {
        throw new HmrcTokenStoreError(
            401,
            "identity_required",
            "A Cognito user identity is required",
        );
    }

    const existing = await client.models.UserData.get({ id: identity.sub });
    throwOnDataErrors("read", existing.errors);

    const hasAccessToken = hasStoredHmrcAccessToken(existing.data);
    const hasRefreshToken = hasStoredHmrcRefreshToken(existing.data);

    return {
        hasAccessToken,
        hasRefreshToken,
        isSignedInWithHmrc: hasAccessToken && hasRefreshToken,
    };
};

export const getStoredHmrcRefreshToken = async (
    client: UserDataClient,
    identity: AppSyncIdentityCognito | null | undefined,
): Promise<string> => {
    if (!identity?.sub) {
        throw new HmrcTokenStoreError(
            401,
            "identity_required",
            "A Cognito user identity is required",
        );
    }

    const existing = await client.models.UserData.get({ id: identity.sub });
    throwOnDataErrors("read", existing.errors);

    if (!existing.data?.refreshToken) {
        throw new HmrcTokenStoreError(
            401,
            "reauthorization_required",
            "HMRC authorization is required for this user",
        );
    }

    return existing.data.refreshToken;
};

export const getStoredHmrcAccessToken = async (
    client: UserDataClient,
    identity: AppSyncIdentityCognito | null | undefined,
    options: GetStoredHmrcAccessTokenOptions = {},
): Promise<string> => {
    if (!identity?.sub) {
        throw new HmrcTokenStoreError(
            401,
            "identity_required",
            "A Cognito user identity is required",
        );
    }

    const existing = await client.models.UserData.get({ id: identity.sub });
    throwOnDataErrors("read", existing.errors);

    const userData = existing.data;

    if (!userData) {
        throw new HmrcTokenStoreError(
            401,
            "reauthorization_required",
            "HMRC authorization is required for this user",
        );
    }

    const now = options.now ?? Date.now();
    const expirationLeewayMs = options.expirationLeewayMs
        ?? ACCESS_TOKEN_EXPIRATION_LEEWAY_MS;
    const expiresAt = userData.accessTokenExpiresAt
        ? Date.parse(userData.accessTokenExpiresAt)
        : Number.NaN;

    if (
        userData.accessToken
        && Number.isFinite(expiresAt)
        && expiresAt > now + expirationLeewayMs
    ) {
        return userData.accessToken;
    }

    if (!userData.refreshToken) {
        throw new HmrcTokenStoreError(
            401,
            "reauthorization_required",
            "HMRC authorization is required for this user",
        );
    }

    const tokenResult = await (options.requestToken ?? requestHmrcToken)({
        grant_type: "refresh_token",
        refresh_token: userData.refreshToken,
    });

    if (!tokenResult.ok) {
        throw new HmrcTokenStoreError(
            tokenResult.error.statusCode,
            "token_refresh_failed",
            tokenResult.error.errorDescription,
        );
    }

    await persistHmrcTokens(client, identity, tokenResult.tokens);

    return tokenResult.tokens.access_token;
};

export const persistHmrcTokens = async (
    client: UserDataClient,
    identity: AppSyncIdentityCognito | null | undefined,
    tokens: HmrcTokenResponse,
): Promise<void> => {
    if (!identity?.sub || !identity.username) {
        throw new HmrcTokenStoreError(
            401,
            "identity_required",
            "A Cognito user identity is required",
        );
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
