import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
    buildFinalDeclarationObligationsPath,
    buildIncomeAndExpenditureObligationsPath,
    HmrcObligationsError,
    parseFinalDeclarationObligationsResponse,
    parseIncomeAndExpenditureObligationsResponse,
    requestHmrcObligations,
} from "./hmrc-obligations";

const originalFetch = globalThis.fetch;
const originalBaseUrl = process.env.HMRC_API_BASE_URL;

afterEach(() => {
    globalThis.fetch = originalFetch;

    if (originalBaseUrl === undefined) {
        delete process.env.HMRC_API_BASE_URL;
    } else {
        process.env.HMRC_API_BASE_URL = originalBaseUrl;
    }
});

test("builds an income and expenditure obligations path with filters", () => {
    const path = buildIncomeAndExpenditureObligationsPath("TC663795B", {
        typeOfBusiness: "self-employment",
        businessId: "XBIS12345678901",
        fromDate: "2025-04-06",
        toDate: "2026-04-05",
        status: "open",
    });

    assert.equal(
        path,
        "/obligations/details/TC663795B/income-and-expenditure"
            + "?typeOfBusiness=self-employment"
            + "&businessId=XBIS12345678901"
            + "&fromDate=2025-04-06"
            + "&toDate=2026-04-05"
            + "&status=open",
    );
});

test("requires a business type whenever a business ID is supplied", () => {
    assert.throws(
        () => buildIncomeAndExpenditureObligationsPath("TC663795B", {
            businessId: "XBIS12345678901",
        }),
        (error: unknown) => {
            assert.ok(error instanceof HmrcObligationsError);
            assert.equal(error.code, "MISSING_TYPE_OF_BUSINESS");
            return true;
        },
    );
});

test("requires both date range parameters", () => {
    assert.throws(
        () => buildIncomeAndExpenditureObligationsPath("TC663795B", {
            fromDate: "2025-04-06",
        }),
        (error: unknown) => {
            assert.ok(error instanceof HmrcObligationsError);
            assert.equal(error.code, "MISSING_TO_DATE");
            return true;
        },
    );
});

test("builds the final declaration path using HMRC's crystallisation route", () => {
    assert.equal(
        buildFinalDeclarationObligationsPath("TC663795B", {
            taxYear: "2025-26",
            status: "fulfilled",
        }),
        "/obligations/details/TC663795B/crystallisation"
            + "?taxYear=2025-26&status=fulfilled",
    );
});

test("parses income and expenditure obligations", () => {
    const result = parseIncomeAndExpenditureObligationsResponse({
        obligations: [{
            typeOfBusiness: "uk-property",
            businessId: "XPIS12345678901",
            obligationDetails: [{
                periodStartDate: "2025-04-06",
                periodEndDate: "2025-07-05",
                dueDate: "2025-08-07",
                status: "fulfilled",
                receivedDate: "2025-08-01",
            }],
        }],
    });

    assert.equal(result.obligations[0]?.typeOfBusiness, "uk-property");
    assert.equal(
        result.obligations[0]?.obligationDetails[0]?.receivedDate,
        "2025-08-01",
    );
});

test("parses multiple final declaration obligations", () => {
    const result = parseFinalDeclarationObligationsResponse({
        obligations: [
            {
                periodStartDate: "2024-04-06",
                periodEndDate: "2025-04-05",
                dueDate: "2026-01-31",
                status: "fulfilled",
                receivedDate: "2025-12-15",
            },
            {
                periodStartDate: "2025-04-06",
                periodEndDate: "2026-04-05",
                dueDate: "2027-01-31",
                status: "open",
            },
        ],
    });

    assert.equal(result.obligations.length, 2);
    assert.equal(result.obligations[1]?.status, "open");
    assert.equal(result.obligations[1]?.receivedDate, undefined);
});

test("requests Obligations API v3 and preserves protected headers", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";

    globalThis.fetch = async (input, init) => {
        const headers = new Headers(init?.headers);

        assert.equal(
            String(input),
            "https://example.test/obligations/details/TC663795B/crystallisation",
        );
        assert.equal(headers.get("accept"), "application/vnd.hmrc.3.0+json");
        assert.equal(headers.get("authorization"), "Bearer access-token");
        assert.equal(headers.get("gov-test-scenario"), "MULTIPLE");
        assert.equal(headers.get("gov-client-device-id"), "device-id");

        return new Response(JSON.stringify({ obligations: [] }), { status: 200 });
    };

    const result = await requestHmrcObligations({
        accessToken: "access-token",
        path: "/obligations/details/TC663795B/crystallisation",
        govTestScenario: "MULTIPLE",
        fraudPreventionHeaders: JSON.stringify({
            authorization: "Bearer untrusted-token",
            accept: "text/plain",
            "Gov-Client-Device-ID": "device-id",
        }),
    }, parseFinalDeclarationObligationsResponse);

    assert.deepEqual(result, { ok: true, data: { obligations: [] } });
});

test("preserves an HMRC error and correlation ID", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    globalThis.fetch = async () => new Response(JSON.stringify({
        code: "NO_OBLIGATIONS_FOUND",
        message: "No obligations found using this filter",
    }), {
        status: 404,
        headers: { "X-CorrelationId": "obligations-correlation-id" },
    });

    const result = await requestHmrcObligations({
        accessToken: "access-token",
        path: "/obligations/details/TC663795B/crystallisation",
    }, parseFinalDeclarationObligationsResponse);

    assert.deepEqual(result, {
        ok: false,
        error: {
            statusCode: 404,
            code: "NO_OBLIGATIONS_FOUND",
            message: "No obligations found using this filter",
            correlationId: "obligations-correlation-id",
        },
    });
});
