import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
    HmrcBusinessDetailsError,
    parseBusinessDetailsResponse,
    parseListBusinessesResponse,
    requestHmrcBusinessDetails,
} from "./hmrc-business-details";

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

test("parses the List All Businesses response", () => {
    const result = parseListBusinessesResponse({
        listOfBusinesses: [
            {
                typeOfBusiness: "self-employment",
                businessId: "XBIS12345678901",
                tradingName: "Example business",
            },
            {
                typeOfBusiness: "foreign-property",
                businessId: "XFIS12345678901",
            },
        ],
    });

    assert.deepEqual(result, {
        listOfBusinesses: [
            {
                typeOfBusiness: "self-employment",
                businessId: "XBIS12345678901",
                tradingName: "Example business",
            },
            {
                typeOfBusiness: "foreign-property",
                businessId: "XFIS12345678901",
                tradingName: undefined,
            },
        ],
    });
});

test("parses the Retrieve Business Details response", () => {
    const result = parseBusinessDetailsResponse({
        businessId: "XBIS12345678901",
        typeOfBusiness: "self-employment",
        latencyDetails: {
            latencyEndDate: "2020-02-27",
            taxYear1: "2018-19",
            latencyIndicator1: "A",
            taxYear2: "2019-20",
            latencyIndicator2: "Q",
        },
        quarterlyTypeChoice: {
            quarterlyPeriodType: "standard",
            taxYearOfChoice: "2023-24",
        },
        accountingPeriods: [
            { start: "2023-04-06", end: "2024-04-05" },
        ],
    });

    assert.equal(result.businessId, "XBIS12345678901");
    assert.equal(result.typeOfBusiness, "self-employment");
    assert.equal(result.latencyDetails?.latencyIndicator2, "Q");
    assert.equal(result.quarterlyTypeChoice?.taxYearOfChoice, "2023-24");
    assert.deepEqual(result.accountingPeriods, [
        { start: "2023-04-06", end: "2024-04-05" },
    ]);
});

test("preserves a structured HMRC error and correlation ID", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    globalThis.fetch = async () => new Response(JSON.stringify({
        code: "NO_BUSINESS_FOUND",
        message: "No business found for given NINO and Business ID",
    }), {
        status: 404,
        headers: { "X-CorrelationId": "correlation-123" },
    });

    const result = await requestHmrcBusinessDetails({
        accessToken: "access-token",
        path: "/individuals/business/details/AA123456A/XBIS12345678901",
    }, parseBusinessDetailsResponse);

    assert.deepEqual(result, {
        ok: false,
        error: {
            statusCode: 404,
            code: "NO_BUSINESS_FOUND",
            message: "No business found for given NINO and Business ID",
            correlationId: "correlation-123",
        },
    });
});

test("returns the List All Businesses error for an unauthorized NINO", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    globalThis.fetch = async () => new Response(JSON.stringify({
        code: "CLIENT_OR_AGENT_NOT_AUTHORISED",
        message: "The client and/or agent is not authorised",
    }), {
        status: 403,
        headers: { "X-CorrelationId": "correlation-nino" },
    });

    const result = await requestHmrcBusinessDetails({
        accessToken: "access-token",
        path: "/individuals/business/details/AA123456A/list",
    }, parseListBusinessesResponse);

    assert.deepEqual(result, {
        ok: false,
        error: {
            statusCode: 403,
            code: "CLIENT_OR_AGENT_NOT_AUTHORISED",
            message: "The client and/or agent is not authorised",
            correlationId: "correlation-nino",
        },
    });
});

test("rejects a malformed successful HMRC response", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    globalThis.fetch = async () => new Response(JSON.stringify({
        listOfBusinesses: "not-an-array",
    }), {
        status: 200,
        headers: { "X-CorrelationId": "correlation-456" },
    });

    const result = await requestHmrcBusinessDetails({
        accessToken: "access-token",
        path: "/individuals/business/details/AA123456A/list",
    }, parseListBusinessesResponse);

    assert.deepEqual(result, {
        ok: false,
        error: {
            statusCode: 502,
            code: "INVALID_HMRC_RESPONSE",
            message: "HMRC returned an invalid business details response",
            correlationId: "correlation-456",
        },
    });
});

test("classifies malformed fraud prevention headers as a client error", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";

    await assert.rejects(
        requestHmrcBusinessDetails({
            accessToken: "access-token",
            path: "/individuals/business/details/AA123456A/list",
            fraudPreventionHeaders: "{not-json",
        }, parseListBusinessesResponse),
        (error: unknown) => {
            assert.ok(error instanceof HmrcBusinessDetailsError);
            assert.equal(error.statusCode, 400);
            assert.equal(error.code, "FORMAT_FRAUD_PREVENTION_HEADERS");
            return true;
        },
    );
});
