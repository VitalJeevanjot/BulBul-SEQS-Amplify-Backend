import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
    buildCumulativeSummaryPath,
    getHmrcCumulativeSummary,
    HmrcCumulativeSummaryError,
    putHmrcCumulativeSummary,
    validateConsolidatedPayload,
    validateNonConsolidatedPayload,
    verifySelfEmploymentBusiness,
} from "./hmrc-cumulative-summary";
import type {
    ConsolidatedCumulativeSummary,
    NonConsolidatedCumulativeSummary,
} from "./hmrc-cumulative-summary.types";

const originalFetch = globalThis.fetch;
const originalBaseUrl = process.env.HMRC_API_BASE_URL;

afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.HMRC_API_BASE_URL;
    else process.env.HMRC_API_BASE_URL = originalBaseUrl;
});

test("builds the Self-Employment Business API v5 cumulative path", () => {
    assert.equal(
        buildCumulativeSummaryPath("TC663795B", "XAIS12345678910", "2025-26"),
        "/individuals/business/self-employment/TC663795B/XAIS12345678910/cumulative/2025-26",
    );
});

test("rejects cumulative summaries before tax year 2025-26", () => {
    assert.throws(
        () => buildCumulativeSummaryPath("TC663795B", "XAIS12345678910", "2024-25"),
        (error: unknown) => {
            assert.ok(error instanceof HmrcCumulativeSummaryError);
            assert.equal(error.code, "RULE_TAX_YEAR_NOT_SUPPORTED");
            return true;
        },
    );
});

test("validates and preserves a consolidated payload", () => {
    assert.deepEqual(validateConsolidatedPayload({
        periodDates: {
            periodStartDate: "2025-04-06",
            periodEndDate: "2025-07-05",
        },
        periodIncome: { turnover: 1_000.99, other: 0 },
        periodExpenses: { consolidatedExpenses: -200.25 },
    }), {
        periodDates: {
            periodStartDate: "2025-04-06",
            periodEndDate: "2025-07-05",
        },
        periodIncome: { turnover: 1_000.99, other: 0 },
        periodExpenses: { consolidatedExpenses: -200.25 },
    });
});

test("validates a non-consolidated payload and removes null optional values", () => {
    assert.deepEqual(validateNonConsolidatedPayload({
        periodIncome: { turnover: 0, other: 0, taxTakenOffTradingIncome: null },
        periodExpenses: { costOfGoods: 100.50, wagesAndStaffCosts: null },
        periodDisallowableExpenses: { costOfGoodsDisallowable: 10.25 },
    }), {
        periodIncome: { turnover: 0, other: 0 },
        periodExpenses: { costOfGoods: 100.50 },
        periodDisallowableExpenses: { costOfGoodsDisallowable: 10.25 },
    });
});

test("requires at least one detailed expense for a non-consolidated payload", () => {
    assert.throws(
        () => validateNonConsolidatedPayload({
            periodIncome: { turnover: 0, other: 0 },
            periodExpenses: {},
        }),
        (error: unknown) => {
            assert.ok(error instanceof HmrcCumulativeSummaryError);
            assert.equal(error.code, "RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED");
            return true;
        },
    );
});

test("PUT uses API v5, JSON, protected authorization, and returns the correlation ID", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    globalThis.fetch = async (input, init) => {
        const headers = new Headers(init?.headers);
        assert.equal(init?.method, "PUT");
        assert.equal(String(input), "https://example.test/cumulative");
        assert.equal(headers.get("accept"), "application/vnd.hmrc.5.0+json");
        assert.equal(headers.get("content-type"), "application/json");
        assert.equal(headers.get("authorization"), "Bearer access-token");
        assert.equal(headers.get("gov-test-scenario"), "STATEFUL");
        assert.equal(headers.get("gov-client-device-id"), "device-id");
        assert.deepEqual(JSON.parse(String(init?.body)), {
            periodIncome: { turnover: 0, other: 0 },
            periodExpenses: { consolidatedExpenses: 0 },
        });
        return new Response(null, {
            status: 204,
            headers: { "X-CorrelationId": "put-correlation-id" },
        });
    };

    const result = await putHmrcCumulativeSummary({
        accessToken: "access-token",
        path: "/cumulative",
        govTestScenario: "STATEFUL",
        fraudPreventionHeaders: JSON.stringify({
            authorization: "untrusted",
            accept: "text/plain",
            "Gov-Client-Device-ID": "device-id",
        }),
    }, {
        periodIncome: { turnover: 0, other: 0 },
        periodExpenses: { consolidatedExpenses: 0 },
    });

    assert.deepEqual(result, {
        ok: true,
        data: { correlationId: "put-correlation-id" },
    });
});

test("GET parses a consolidated response", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    globalThis.fetch = async () => new Response(JSON.stringify({
        periodDates: { periodStartDate: "2025-04-06", periodEndDate: "2025-07-05" },
        periodIncome: { turnover: 200, other: 0 },
        periodExpenses: { consolidatedExpenses: 150.75 },
    }), { status: 200 });

    const result = await getHmrcCumulativeSummary<ConsolidatedCumulativeSummary>({
        accessToken: "access-token",
        path: "/cumulative",
    }, "consolidated");

    assert.equal(result.ok && result.data.periodExpenses?.consolidatedExpenses, 150.75);
});

test("GET parses a non-consolidated response", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    globalThis.fetch = async () => new Response(JSON.stringify({
        periodDates: { periodStartDate: "2025-04-06", periodEndDate: "2025-07-05" },
        periodIncome: { turnover: 200, other: 0 },
        periodExpenses: { costOfGoods: 20, professionalFees: 30 },
        periodDisallowableExpenses: { professionalFeesDisallowable: 5 },
    }), { status: 200 });

    const result = await getHmrcCumulativeSummary<NonConsolidatedCumulativeSummary>({
        accessToken: "access-token",
        path: "/cumulative",
    }, "non-consolidated");

    assert.equal(result.ok && result.data.periodExpenses?.professionalFees, 30);
    assert.equal(
        result.ok && result.data.periodDisallowableExpenses?.professionalFeesDisallowable,
        5,
    );
});

test("the PUT preflight accepts only self-employment business details", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    globalThis.fetch = async (_input, init) => {
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("gov-test-scenario"), null);
        return new Response(JSON.stringify({
            businessId: "XAIS12345678910",
            typeOfBusiness: "uk-property",
        }), { status: 200 });
    };

    const result = await verifySelfEmploymentBusiness({
        accessToken: "access-token",
        nino: "TC663795B",
        businessId: "XAIS12345678910",
    });

    assert.deepEqual(result, {
        ok: false,
        error: {
            statusCode: 400,
            code: "RULE_BUSINESS_NOT_SELF_EMPLOYMENT",
            message: "The provided Business ID does not belong to a self-employment business",
        },
    });
});
