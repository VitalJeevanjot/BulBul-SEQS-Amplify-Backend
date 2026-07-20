import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
    parseHmrcTokenResponse,
    requestHmrcToken,
    tokenMetadata,
} from "./hmrc-oauth";

const originalFetch = globalThis.fetch;
const originalEnvironment = {
    clientId: process.env.HMRC_CLIENT_ID,
    clientSecret: process.env.HMRC_CLIENT_SECRET,
    tokenUrl: process.env.HMRC_TOKEN_URL,
};

const setTestEnvironment = (): void => {
    process.env.HMRC_CLIENT_ID = "client-id";
    process.env.HMRC_CLIENT_SECRET = "client-secret";
    process.env.HMRC_TOKEN_URL = "https://example.test/oauth/token";
};

const restoreEnvironmentVariable = (
    name: "HMRC_CLIENT_ID" | "HMRC_CLIENT_SECRET" | "HMRC_TOKEN_URL",
    value: string | undefined,
): void => {
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
};

afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnvironmentVariable("HMRC_CLIENT_ID", originalEnvironment.clientId);
    restoreEnvironmentVariable("HMRC_CLIENT_SECRET", originalEnvironment.clientSecret);
    restoreEnvironmentVariable("HMRC_TOKEN_URL", originalEnvironment.tokenUrl);
});

test("parses a complete HMRC token response", () => {
    const tokens = parseHmrcTokenResponse({
        access_token: "access-token",
        token_type: "bearer",
        expires_in: 14400,
        refresh_token: "refresh-token",
        scope: "read:self-assessment",
    });

    assert.deepEqual(tokens, {
        access_token: "access-token",
        token_type: "bearer",
        expires_in: 14400,
        refresh_token: "refresh-token",
        scope: "read:self-assessment",
    });
});

test("returns validated tokens from the token endpoint", async () => {
    setTestEnvironment();
    let submittedBody: URLSearchParams | undefined;

    globalThis.fetch = async (_input, init) => {
        submittedBody = init?.body as URLSearchParams;
        return new Response(JSON.stringify({
            access_token: "access-token",
            token_type: "bearer",
            expires_in: 14400,
            refresh_token: "refresh-token",
        }), { status: 200 });
    };

    const result = await requestHmrcToken({
        grant_type: "refresh_token",
        refresh_token: "old-refresh-token",
    });

    assert.equal(result.ok, true);
    assert.equal(submittedBody?.get("grant_type"), "refresh_token");
    assert.equal(submittedBody?.get("refresh_token"), "old-refresh-token");
    assert.equal(submittedBody?.get("client_id"), "client-id");
});

test("returns a structured configuration error", async () => {
    delete process.env.HMRC_CLIENT_ID;
    delete process.env.HMRC_CLIENT_SECRET;
    delete process.env.HMRC_TOKEN_URL;

    const result = await requestHmrcToken({
        grant_type: "authorization_code",
        code: "authorization-code",
    });

    assert.deepEqual(result, {
        ok: false,
        error: {
            statusCode: 500,
            error: "oauth_configuration_error",
            errorDescription: "The HMRC OAuth service is not configured",
        },
    });
});

test("preserves a structured HMRC OAuth error", async () => {
    setTestEnvironment();
    globalThis.fetch = async () => new Response(JSON.stringify({
        error: "invalid_grant",
        error_description: "refresh token is invalid",
    }), { status: 400 });

    const result = await requestHmrcToken({
        grant_type: "refresh_token",
        refresh_token: "expired-refresh-token",
    });

    assert.deepEqual(result, {
        ok: false,
        error: {
            statusCode: 400,
            error: "invalid_grant",
            errorDescription: "refresh token is invalid",
        },
    });
});

test("rejects a malformed successful token response", async () => {
    setTestEnvironment();
    globalThis.fetch = async () => new Response(JSON.stringify({
        access_token: "access-token",
        token_type: "bearer",
        expires_in: "four hours",
    }), { status: 200 });

    const result = await requestHmrcToken({
        grant_type: "authorization_code",
        code: "authorization-code",
        redirect_uri: "app://callback",
    });

    assert.deepEqual(result, {
        ok: false,
        error: {
            statusCode: 502,
            error: "invalid_hmrc_response",
            errorDescription: "HMRC returned an invalid token response",
        },
    });
});

test("returns safe token metadata without exposing either token", () => {
    const metadata = tokenMetadata({
        access_token: "access-token",
        token_type: "bearer",
        expires_in: 14400,
        refresh_token: "refresh-token",
        scope: "read:self-assessment",
    }, Date.parse("2026-07-19T00:00:00.000Z"));

    assert.deepEqual(metadata, {
        tokenType: "bearer",
        expiresIn: 14400,
        expiresAt: "2026-07-19T04:00:00.000Z",
        scope: "read:self-assessment",
    });
    assert.equal("accessToken" in metadata, false);
    assert.equal("refreshToken" in metadata, false);
});
