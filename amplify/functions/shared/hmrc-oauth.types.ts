export type HmrcTokenRequest = {
    grant_type: "authorization_code" | "refresh_token";
    code?: string;
    redirect_uri?: string;
    refresh_token?: string;
};

export type HmrcTokenResponse = {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope?: string;
};

export type HmrcOAuthError = {
    statusCode: number;
    error: string;
    errorDescription: string;
};

export type HmrcTokenRequestResult =
    | { ok: true; tokens: HmrcTokenResponse }
    | { ok: false; error: HmrcOAuthError };

export type HmrcOAuthTokenMetadata = {
    tokenType: string;
    expiresIn: number;
    expiresAt: string;
    scope?: string;
};
