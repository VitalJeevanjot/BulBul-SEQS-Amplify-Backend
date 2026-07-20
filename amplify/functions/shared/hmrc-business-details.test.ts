import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
    checkHmrcNinoAuthorization,
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

test("confirms a NINO authorized for the signed-in HMRC user", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    globalThis.fetch = async () => new Response(JSON.stringify({
        listOfBusinesses: [],
    }), { status: 200 });

    const result = await checkHmrcNinoAuthorization(
        "access-token",
        "AA123456A",
    );

    assert.deepEqual(result, { ok: true, data: { isValid: true } });
});

test("rejects a NINO that is not authorized for the HMRC credentials", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    globalThis.fetch = async () => new Response(JSON.stringify({
        code: "FORBIDDEN",
        message: "The client and/or agent is not authorised",
    }), { status: 403 });

    const result = await checkHmrcNinoAuthorization(
        "access-token",
        "AA123456A",
    );

    assert.deepEqual(result, { ok: true, data: { isValid: false } });
});

test("rejects an invalid NINO format without calling HMRC", async () => {
    let fetchCalls = 0;
    globalThis.fetch = async () => {
        fetchCalls += 1;
        throw new Error("HMRC should not be called");
    };

    const result = await checkHmrcNinoAuthorization(
        "access-token",
        "not-a-nino",
    );

    assert.deepEqual(result, { ok: true, data: { isValid: false } });
    assert.equal(fetchCalls, 0);
});
