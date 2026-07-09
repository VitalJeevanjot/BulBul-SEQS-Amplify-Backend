type HmrcTokenRequest = {
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

const requiredEnvironmentVariable = (name: string): string => {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
};

export const requestHmrcToken = async (
    request: HmrcTokenRequest,
): Promise<HmrcTokenResponse> => {
    const body = new URLSearchParams({
        client_id: requiredEnvironmentVariable("HMRC_CLIENT_ID"),
        client_secret: requiredEnvironmentVariable("HMRC_CLIENT_SECRET"),
        grant_type: request.grant_type,
    });

    if (request.code) body.set("code", request.code);
    if (request.redirect_uri) body.set("redirect_uri", request.redirect_uri);
    if (request.refresh_token) body.set("refresh_token", request.refresh_token);

    const response = await fetch(requiredEnvironmentVariable("HMRC_TOKEN_URL"), {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
        },
        body,
    });

    if (!response.ok) {
        const details = await response.text();
        throw new Error(`HMRC token request failed (${response.status}): ${details}`);
    }

    return response.json() as Promise<HmrcTokenResponse>;
};
