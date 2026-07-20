import type { HmrcTokenResponse } from "./hmrc-oauth.types";

export type AuditLogClient = {
    models: {
        HmrcOAuthAuditLog: {
            create(input: Record<string, unknown>): Promise<{
                errors?: readonly unknown[];
            }>;
        };
    };
};

export type AuditEventType =
    | "HMRC_AUTHORIZATION_CODE_EXCHANGE"
    | "HMRC_REFRESH_TOKEN_EXCHANGE";

export type AuditOutcome = "SUCCEEDED" | "FAILED";

export type AuditLogEntry = {
    eventType: AuditEventType;
    outcome: AuditOutcome;
    stateId?: string;
    tokens?: HmrcTokenResponse;
    errorMessage?: string;
};
