import assert from "node:assert/strict";
import test from "node:test";
import type { AppSyncIdentityCognito } from "aws-lambda";
import {
    getStoredHmrcTokenStatus,
    getStoredHmrcAccessToken,
    hasStoredHmrcAccessToken,
    hasStoredHmrcRefreshToken,
    HmrcTokenStoreError,
} from "./persist-hmrc-tokens";
import type { StoredUserData } from "./persist-hmrc-tokens.types";

const identity = {
    sub: "user-id",
    username: "user@example.com",
} as AppSyncIdentityCognito;

const createClient = (userData: StoredUserData) => {
    const updates: Record<string, unknown>[] = [];
    const client = {
        models: {
            UserData: {
                async get() {
                    return { data: userData };
                },
                async create() {
                    return {};
                },
                async update(input: Record<string, unknown>) {
                    updates.push(input);
                    return {};
                },
            },
        },
    };

    return { client, updates };
};

test("checks stored HMRC token presence without exposing token values", async () => {
    const userData = {
        id: identity.sub,
        accessToken: "access-token",
        refreshToken: "refresh-token",
    };
    const { client } = createClient(userData);

    assert.equal(hasStoredHmrcAccessToken(userData), true);
    assert.equal(hasStoredHmrcRefreshToken(userData), true);
    assert.deepEqual(await getStoredHmrcTokenStatus(client, identity), {
        isSignedInWithHmrc: true,
    });
});

test("does not treat blank stored HMRC tokens as present", async () => {
    const userData = {
        id: identity.sub,
        accessToken: "  ",
        refreshToken: "",
    };
    const { client } = createClient(userData);

    assert.equal(hasStoredHmrcAccessToken(userData), false);
    assert.equal(hasStoredHmrcRefreshToken(userData), false);
    assert.deepEqual(await getStoredHmrcTokenStatus(client, identity), {
        isSignedInWithHmrc: false,
    });
});

test("requires both stored HMRC tokens to consider the user signed in", async () => {
    const accessTokenOnly = createClient({
        id: identity.sub,
        accessToken: "access-token",
    });
    const refreshTokenOnly = createClient({
        id: identity.sub,
        refreshToken: "refresh-token",
    });

    assert.deepEqual(
        await getStoredHmrcTokenStatus(accessTokenOnly.client, identity),
        { isSignedInWithHmrc: false },
    );
    assert.deepEqual(
        await getStoredHmrcTokenStatus(refreshTokenOnly.client, identity),
        { isSignedInWithHmrc: false },
    );
});

test("returns a stored HMRC access token while it is still valid", async () => {
    const now = Date.parse("2026-07-19T10:00:00.000Z");
    const { client, updates } = createClient({
        id: identity.sub,
        accessToken: "current-access-token",
        refreshToken: "refresh-token",
        accessTokenExpiresAt: "2026-07-19T10:05:00.000Z",
    });
    let refreshRequests = 0;

    const accessToken = await getStoredHmrcAccessToken(client, identity, {
        now,
        requestToken: async () => {
            refreshRequests += 1;
            throw new Error("The token should not be refreshed");
        },
    });

    assert.equal(accessToken, "current-access-token");
    assert.equal(refreshRequests, 0);
    assert.deepEqual(updates, []);
});

test("refreshes and persists an expired HMRC access token", async () => {
    const now = Date.parse("2026-07-19T10:00:00.000Z");
    const { client, updates } = createClient({
        id: identity.sub,
        accessToken: "expired-access-token",
        refreshToken: "current-refresh-token",
        accessTokenExpiresAt: "2026-07-19T09:59:59.000Z",
    });

    const accessToken = await getStoredHmrcAccessToken(client, identity, {
        now,
        requestToken: async (request) => {
            assert.deepEqual(request, {
                grant_type: "refresh_token",
                refresh_token: "current-refresh-token",
            });
            return {
                ok: true,
                tokens: {
                    access_token: "new-access-token",
                    refresh_token: "new-refresh-token",
                    token_type: "bearer",
                    expires_in: 14_400,
                },
            };
        },
    });

    assert.equal(accessToken, "new-access-token");
    assert.equal(updates.length, 1);
    assert.equal(updates[0]?.accessToken, "new-access-token");
    assert.equal(updates[0]?.refreshToken, "new-refresh-token");
});

test("refreshes when the stored expiration timestamp is missing", async () => {
    const { client } = createClient({
        id: identity.sub,
        accessToken: "legacy-access-token",
        refreshToken: "refresh-token",
    });

    const accessToken = await getStoredHmrcAccessToken(client, identity, {
        requestToken: async () => ({
            ok: true,
            tokens: {
                access_token: "refreshed-access-token",
                refresh_token: "refreshed-refresh-token",
                token_type: "bearer",
                expires_in: 14_400,
            },
        }),
    });

    assert.equal(accessToken, "refreshed-access-token");
});

test("refreshes a token that expires within the safety window", async () => {
    const now = Date.parse("2026-07-19T10:00:00.000Z");
    const { client } = createClient({
        id: identity.sub,
        accessToken: "nearly-expired-access-token",
        refreshToken: "refresh-token",
        accessTokenExpiresAt: "2026-07-19T10:00:30.000Z",
    });
    let refreshRequests = 0;

    const accessToken = await getStoredHmrcAccessToken(client, identity, {
        now,
        requestToken: async () => {
            refreshRequests += 1;
            return {
                ok: true,
                tokens: {
                    access_token: "refreshed-access-token",
                    refresh_token: "refreshed-refresh-token",
                    token_type: "bearer",
                    expires_in: 14_400,
                },
            };
        },
    });

    assert.equal(accessToken, "refreshed-access-token");
    assert.equal(refreshRequests, 1);
});

test("requires reauthorization when an expired token has no refresh token", async () => {
    const { client } = createClient({
        id: identity.sub,
        accessToken: "expired-access-token",
        accessTokenExpiresAt: "2020-01-01T00:00:00.000Z",
    });

    await assert.rejects(
        getStoredHmrcAccessToken(client, identity),
        (error: unknown) => {
            assert.ok(error instanceof HmrcTokenStoreError);
            assert.equal(error.statusCode, 401);
            assert.equal(error.code, "reauthorization_required");
            return true;
        },
    );
});

test("surfaces an HMRC token refresh failure", async () => {
    const { client } = createClient({
        id: identity.sub,
        accessToken: "expired-access-token",
        refreshToken: "invalid-refresh-token",
        accessTokenExpiresAt: "2020-01-01T00:00:00.000Z",
    });

    await assert.rejects(
        getStoredHmrcAccessToken(client, identity, {
            requestToken: async () => ({
                ok: false,
                error: {
                    statusCode: 400,
                    error: "invalid_grant",
                    errorDescription: "The refresh token is invalid",
                },
            }),
        }),
        (error: unknown) => {
            assert.ok(error instanceof HmrcTokenStoreError);
            assert.equal(error.statusCode, 400);
            assert.equal(error.code, "token_refresh_failed");
            assert.equal(error.message, "The refresh token is invalid");
            return true;
        },
    );
});
