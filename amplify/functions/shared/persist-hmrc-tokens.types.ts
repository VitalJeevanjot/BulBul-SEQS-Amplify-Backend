import type { HmrcTokenRequestResult } from "./hmrc-oauth.types";

export type StoredUserData = {
    id: string;
    accessToken?: string | null;
    refreshToken?: string | null;
    accessTokenExpiresAt?: string | null;
};

export type UserDataClient = {
    models: {
        UserData: {
            get(input: { id: string }): Promise<{
                data?: StoredUserData | null;
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

export type HmrcTokenStoreErrorCode =
    | "identity_required"
    | "reauthorization_required"
    | "token_refresh_failed"
    | "token_storage_failed";

export type GetStoredHmrcAccessTokenOptions = {
    now?: number;
    expirationLeewayMs?: number;
    requestToken?: (request: {
        grant_type: "refresh_token";
        refresh_token: string;
    }) => Promise<HmrcTokenRequestResult>;
};

export type HmrcTokenStatus = {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    isSignedInWithHmrc: boolean;
};
