import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
    createHmrcTestBusiness,
    HmrcTestBusinessError,
    validateCreateTestBusinessPayload,
} from "./hmrc-test-business";

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

test("creates a self-employment test business using HMRC API version 1.0", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    let requestUrl: string | undefined;
    let requestInit: RequestInit | undefined;

    globalThis.fetch = async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return new Response(JSON.stringify({ businessId: "XAIS12345678910" }), {
            status: 201,
            headers: { "X-CorrelationId": "correlation-create" },
        });
    };

    const result = await createHmrcTestBusiness({
        accessToken: "access-token",
        nino: "AA123456A",
        business: {
            typeOfBusiness: "self-employment",
            tradingName: "Self Employed Name",
            accountingType: null,
            businessAddressLineOne: "Line 1 of address",
            businessAddressPostcode: null,
            businessAddressCountryCode: "FR",
        },
    });

    assert.deepEqual(result, {
        ok: true,
        data: { businessId: "XAIS12345678910" },
    });
    assert.equal(
        requestUrl,
        "https://example.test/individuals/self-assessment-test-support/business/AA123456A",
    );
    assert.equal(requestInit?.method, "POST");
    assert.deepEqual(requestInit?.headers, {
        accept: "application/vnd.hmrc.1.0+json",
        authorization: "Bearer access-token",
        "content-type": "application/json",
    });
    assert.deepEqual(JSON.parse(String(requestInit?.body)), {
        typeOfBusiness: "self-employment",
        tradingName: "Self Employed Name",
        businessAddressLineOne: "Line 1 of address",
        businessAddressCountryCode: "FR",
    });
});

test("accepts the documented minimal UK property business", () => {
    assert.deepEqual(validateCreateTestBusinessPayload({
        typeOfBusiness: "uk-property",
    }), {
        typeOfBusiness: "uk-property",
    });
});

test("rejects a self-employment business without its mandatory details", () => {
    assert.throws(
        () => validateCreateTestBusinessPayload({
            typeOfBusiness: "self-employment",
        }),
        (error: unknown) => {
            assert.ok(error instanceof HmrcTestBusinessError);
            assert.equal(error.code, "RULE_MISSING_TRADING_NAME");
            return true;
        },
    );
});

test("rejects address details for property businesses", () => {
    assert.throws(
        () => validateCreateTestBusinessPayload({
            typeOfBusiness: "foreign-property",
            businessAddressCountryCode: "FR",
        }),
        (error: unknown) => {
            assert.ok(error instanceof HmrcTestBusinessError);
            assert.equal(error.code, "RULE_UNEXPECTED_BUSINESS_ADDRESS");
            return true;
        },
    );
});

test("preserves a structured HMRC error and correlation ID", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    globalThis.fetch = async () => new Response(JSON.stringify({
        code: "RULE_PROPERTY_BUSINESS_ADDED",
        message: "A property business of this type has already been added",
    }), {
        status: 400,
        headers: { "X-CorrelationId": "correlation-property" },
    });

    const result = await createHmrcTestBusiness({
        accessToken: "access-token",
        nino: "AA123456A",
        business: { typeOfBusiness: "uk-property" },
    });

    assert.deepEqual(result, {
        ok: false,
        error: {
            statusCode: 400,
            code: "RULE_PROPERTY_BUSINESS_ADDED",
            message: "A property business of this type has already been added",
            correlationId: "correlation-property",
        },
    });
});

test("rejects a malformed successful HMRC response", async () => {
    process.env.HMRC_API_BASE_URL = "https://example.test";
    globalThis.fetch = async () => new Response(JSON.stringify({
        businessId: "not-a-business-id",
    }), {
        status: 201,
        headers: { "X-CorrelationId": "correlation-invalid" },
    });

    const result = await createHmrcTestBusiness({
        accessToken: "access-token",
        nino: "AA123456A",
        business: { typeOfBusiness: "property-unspecified" },
    });

    assert.deepEqual(result, {
        ok: false,
        error: {
            statusCode: 502,
            code: "INVALID_HMRC_RESPONSE",
            message: "HMRC returned an invalid create test business response",
            correlationId: "correlation-invalid",
        },
    });
});
