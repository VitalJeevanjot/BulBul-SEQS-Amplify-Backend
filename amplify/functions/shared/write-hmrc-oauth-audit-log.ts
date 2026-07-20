import type { AppSyncIdentityCognito } from "aws-lambda";
import { createHash } from "node:crypto";
import type {
    AuditLogClient,
    AuditLogEntry,
} from "./write-hmrc-oauth-audit-log.types";

const fingerprintToken = (token: string): string =>
    createHash("sha256").update(token).digest("hex");

export const writeHmrcOAuthAuditLog = async (
    client: AuditLogClient,
    identity: AppSyncIdentityCognito | null | undefined,
    entry: AuditLogEntry,
): Promise<void> => {
    if (!identity?.sub || !identity.username) {
        throw new Error("A Cognito user identity is required");
    }

    const tokenData = entry.tokens
        ? {
            accessTokenFingerprint: fingerprintToken(entry.tokens.access_token),
            accessTokenExpiresAt: new Date(
                Date.now() + entry.tokens.expires_in * 1000,
            ).toISOString(),
            refreshTokenFingerprint: fingerprintToken(
                entry.tokens.refresh_token,
            ),
        }
        : {};

    const result = await client.models.HmrcOAuthAuditLog.create({
        owner: `${identity.sub}::${identity.username}`,
        userId: identity.sub,
        username: identity.username,
        eventType: entry.eventType,
        outcome: entry.outcome,
        occurredAt: new Date().toISOString(),
        ...(entry.stateId ? { stateId: entry.stateId } : {}),
        ...tokenData,
        ...(entry.errorMessage
            ? { errorMessage: entry.errorMessage.slice(0, 500) }
            : {}),
    });

    if (result.errors?.length) {
        throw new Error("Unable to write the HMRC OAuth audit log");
    }
};
