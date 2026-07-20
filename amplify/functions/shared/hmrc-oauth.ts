import type {
    HmrcOAuthError,
    HmrcOAuthTokenMetadata,
    HmrcTokenRequest,
    HmrcTokenRequestResult,
    HmrcTokenResponse,
} from "./hmrc-oauth.types";

const requiredEnvironmentVariable = (name: string): string => {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
};

export const requestHmrcToken = async (
    request: HmrcTokenRequest,
): Promise<HmrcTokenRequestResult> => {
    let body: URLSearchParams;

    try {
        body = new URLSearchParams({
            client_id: requiredEnvironmentVariable("HMRC_CLIENT_ID"),
            client_secret: requiredEnvironmentVariable("HMRC_CLIENT_SECRET"),
            grant_type: request.grant_type,
        });
    } catch {
        return {
            ok: false,
            error: {
                statusCode: 500,
                error: "oauth_configuration_error",
                errorDescription: "The HMRC OAuth service is not configured",
            },
        };
    }

    if (request.code) body.set("code", request.code);
    if (request.redirect_uri) body.set("redirect_uri", request.redirect_uri);
    if (request.refresh_token) body.set("refresh_token", request.refresh_token);

    let response: Response;

    try {
        response = await fetch(requiredEnvironmentVariable("HMRC_TOKEN_URL"), {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            body,
        });
    } catch {
        return {
            ok: false,
            error: {
                statusCode: 502,
                error: "hmrc_unavailable",
                errorDescription: "Unable to reach the HMRC token service",
            },
        };
    }

    let responseBody: string;

    try {
        responseBody = await response.text();
    } catch {
        return {
            ok: false,
            error: {
                statusCode: 502,
                error: "hmrc_unavailable",
                errorDescription: "Unable to read the HMRC token response",
            },
        };
    }

    if (!response.ok) {
        return {
            ok: false,
            error: parseHmrcOAuthError(response.status, responseBody),
        };
    }

    try {
        return {
            ok: true,
            tokens: parseHmrcTokenResponse(JSON.parse(responseBody) as unknown),
        };
    } catch {
        return {
            ok: false,
            error: {
                statusCode: 502,
                error: "invalid_hmrc_response",
                errorDescription: "HMRC returned an invalid token response",
            },
        };
    }
};

const asObject = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Expected an object");
    }

    return value as Record<string, unknown>;
};

const requiredString = (
    object: Record<string, unknown>,
    field: string,
): string => {
    const value = object[field];

    if (typeof value !== "string" || !value) {
        throw new Error(`${field} must be a non-empty string`);
    }

    return value;
};

const optionalString = (
    object: Record<string, unknown>,
    field: string,
): string | undefined => {
    const value = object[field];

    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== "string") {
        throw new Error(`${field} must be a string`);
    }

    return value;
};

export const parseHmrcTokenResponse = (value: unknown): HmrcTokenResponse => {
    const object = asObject(value);
    const expiresIn = object.expires_in;

    if (!Number.isInteger(expiresIn) || (expiresIn as number) <= 0) {
        throw new Error("expires_in must be a positive integer");
    }

    return {
        access_token: requiredString(object, "access_token"),
        token_type: requiredString(object, "token_type"),
        expires_in: expiresIn as number,
        refresh_token: requiredString(object, "refresh_token"),
        scope: optionalString(object, "scope"),
    };
};

export const parseHmrcOAuthError = (
    statusCode: number,
    responseBody: string,
): HmrcOAuthError => {
    try {
        const object = asObject(JSON.parse(responseBody) as unknown);
        const error = requiredString(object, "error");
        const errorDescription = optionalString(object, "error_description")
            ?? optionalString(object, "message")
            ?? `HMRC token request failed with status ${statusCode}`;

        return { statusCode, error, errorDescription };
    } catch {
        return {
            statusCode,
            error: "hmrc_token_request_failed",
            errorDescription: `HMRC token request failed with status ${statusCode}`,
        };
    }
};

export const tokenMetadata = (
    tokens: HmrcTokenResponse,
    now = Date.now(),
): HmrcOAuthTokenMetadata => ({
    tokenType: tokens.token_type,
    expiresIn: tokens.expires_in,
    expiresAt: new Date(now + tokens.expires_in * 1000).toISOString(),
    scope: tokens.scope,
});
