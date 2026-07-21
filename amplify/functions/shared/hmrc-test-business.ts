import type {
    CreateHmrcTestBusinessOptions,
    CreateTestBusinessPayload,
    CreateTestBusinessResponse,
    HmrcTestBusinessErrorResponse,
    HmrcTestBusinessResult,
    TestBusinessLatencyDetails,
    TestBusinessQuarterlyTypeChoice,
    TestBusinessType,
} from "./hmrc-test-business.types";

const HMRC_TEST_SUPPORT_API_VERSION = "application/vnd.hmrc.1.0+json";
const NINO_REGEX = /^((?!(BG|GB|KN|NK|NT|TN|ZZ)|(D|F|I|Q|U|V)[A-Z]|[A-Z](D|F|I|O|Q|U|V))[A-Z]{2})[0-9]{6}[A-D]$/;
const BUSINESS_ID_REGEX = /^X[A-Z0-9]IS[0-9]{11}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TAX_YEAR_REGEX = /^(2\d{3})-(\d{2})$/;
const POSTCODE_REGEX = /^(?:[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}|BFPO\s?[0-9]{1,10})$/;

const BUSINESS_TYPES = new Set<TestBusinessType>([
    "self-employment",
    "uk-property",
    "foreign-property",
    "property-unspecified",
]);

const ADDRESS_FIELDS = [
    "businessAddressLineOne",
    "businessAddressLineTwo",
    "businessAddressLineThree",
    "businessAddressLineFour",
    "businessAddressPostcode",
    "businessAddressCountryCode",
] as const;

export class HmrcTestBusinessError extends Error {
    readonly statusCode: number;
    readonly code: string;

    constructor(statusCode: number, code: string, message: string) {
        super(message);
        this.name = "HmrcTestBusinessError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

const requiredEnvironmentVariable = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
};

const clientError = (code: string, message: string): never => {
    throw new HmrcTestBusinessError(400, code, message);
};

const hasValue = (value: unknown): boolean => value !== undefined && value !== null;

const validDate = (value: string): boolean => {
    if (!DATE_REGEX.test(value)) return false;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(timestamp)) return false;
    const normalized = new Date(timestamp).toISOString().slice(0, 10);
    return normalized === value && value >= "1900-01-01" && value <= "2100-01-01";
};

const validateDate = (value: string | null | undefined, field: string): void => {
    if (hasValue(value) && (typeof value !== "string" || !validDate(value))) {
        clientError("FORMAT_DATE", `${field} must be a valid date in YYYY-MM-DD format`);
    }
};

const validateTaxYear = (value: string, field: string): void => {
    const match = TAX_YEAR_REGEX.exec(value);
    if (!match) {
        return clientError("FORMAT_TAX_YEAR", `${field} must be in YYYY-YY format`);
    }

    const startYear = Number(match[1]);
    const expectedEndYear = String((startYear + 1) % 100).padStart(2, "0");
    if (match[2] !== expectedEndYear) {
        clientError("RULE_TAX_YEAR_RANGE_INVALID", `${field} must span consecutive years`);
    }
};

const validateLatencyDetails = (value: TestBusinessLatencyDetails): void => {
    const requiredFields: (keyof TestBusinessLatencyDetails)[] = [
        "latencyEndDate",
        "taxYear1",
        "latencyIndicator1",
        "taxYear2",
        "latencyIndicator2",
    ];

    for (const field of requiredFields) {
        if (!hasValue(value[field])) {
            clientError(
                "RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED",
                `latencyDetails.${field} is required`,
            );
        }
    }

    validateDate(value.latencyEndDate, "latencyDetails.latencyEndDate");
    validateTaxYear(value.taxYear1, "latencyDetails.taxYear1");
    validateTaxYear(value.taxYear2, "latencyDetails.taxYear2");

    if (!["A", "Q"].includes(value.latencyIndicator1)) {
        clientError("FORMAT_LATENCY_INDICATOR", "latencyIndicator1 must be A or Q");
    }
    if (!["A", "Q"].includes(value.latencyIndicator2)) {
        clientError("FORMAT_LATENCY_INDICATOR", "latencyIndicator2 must be A or Q");
    }
};

const validateQuarterlyTypeChoice = (
    value: TestBusinessQuarterlyTypeChoice,
): void => {
    if (!hasValue(value.quarterlyPeriodType)) {
        clientError(
            "RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED",
            "quarterlyTypeChoice.quarterlyPeriodType is required",
        );
    }
    if (!hasValue(value.taxYearOfChoice)) {
        clientError(
            "RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED",
            "quarterlyTypeChoice.taxYearOfChoice is required",
        );
    }
    if (!["standard", "calendar"].includes(value.quarterlyPeriodType)) {
        clientError(
            "FORMAT_QUARTERLY_PERIOD_TYPE",
            "quarterlyPeriodType must be standard or calendar",
        );
    }
    validateTaxYear(value.taxYearOfChoice, "quarterlyTypeChoice.taxYearOfChoice");
};

const withoutNullValues = <T extends object>(value: T): T =>
    Object.fromEntries(
        Object.entries(value).filter(([, fieldValue]) => fieldValue !== null),
    ) as T;

export const validateCreateTestBusinessPayload = (
    value: CreateTestBusinessPayload,
): CreateTestBusinessPayload => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return clientError(
            "RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED",
            "A test business payload is required",
        );
    }

    if (!BUSINESS_TYPES.has(value.typeOfBusiness)) {
        clientError("FORMAT_TYPE_OF_BUSINESS", "The type of business is invalid");
    }

    validateDate(value.firstAccountingPeriodStartDate, "firstAccountingPeriodStartDate");
    validateDate(value.firstAccountingPeriodEndDate, "firstAccountingPeriodEndDate");
    validateDate(value.commencementDate, "commencementDate");
    validateDate(value.cessationDate, "cessationDate");

    const hasStart = hasValue(value.firstAccountingPeriodStartDate);
    const hasEnd = hasValue(value.firstAccountingPeriodEndDate);
    if (!hasStart && hasEnd) {
        clientError(
            "MISSING_FIRST_ACCOUNTING_PERIOD_START_DATE",
            "firstAccountingPeriodStartDate is required when the end date is provided",
        );
    }
    if (hasStart && !hasEnd) {
        clientError(
            "MISSING_FIRST_ACCOUNTING_PERIOD_END_DATE",
            "firstAccountingPeriodEndDate is required when the start date is provided",
        );
    }

    if (value.commencementDate) {
        const today = new Date().toISOString().slice(0, 10);
        if (value.commencementDate >= today) {
            clientError(
                "RULE_COMMENCEMENT_DATE_NOT_SUPPORTED",
                "commencementDate must be in the past",
            );
        }
    }

    if (value.latencyDetails) validateLatencyDetails(value.latencyDetails);
    if (value.quarterlyTypeChoice) {
        validateQuarterlyTypeChoice(value.quarterlyTypeChoice);
    }

    if (
        hasValue(value.accountingType)
        && !["CASH", "ACCRUALS"].includes(value.accountingType as string)
    ) {
        clientError("FORMAT_ACCOUNTING_TYPE", "accountingType must be CASH or ACCRUALS");
    }

    for (const field of ADDRESS_FIELDS.slice(0, 4)) {
        const addressLine = value[field];
        if (hasValue(addressLine) && (typeof addressLine !== "string" || addressLine.length > 35)) {
            clientError("RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED", `${field} cannot exceed 35 characters`);
        }
    }

    if (
        hasValue(value.businessAddressCountryCode)
        && !/^[A-Z]{2}$/.test(value.businessAddressCountryCode as string)
    ) {
        clientError("FORMAT_COUNTRY_CODE", "businessAddressCountryCode must be a two-letter ISO country code");
    }

    if (
        hasValue(value.businessAddressPostcode)
        && !POSTCODE_REGEX.test(value.businessAddressPostcode as string)
    ) {
        clientError("FORMAT_POSTCODE", "The business postcode is invalid");
    }

    const isSelfEmployment = value.typeOfBusiness === "self-employment";
    const hasAnyAddress = ADDRESS_FIELDS.some((field) => hasValue(value[field]));
    if (isSelfEmployment) {
        if (!hasValue(value.tradingName)) {
            clientError("RULE_MISSING_TRADING_NAME", "tradingName is required for self-employment businesses");
        }
        if (
            !hasValue(value.businessAddressLineOne)
            || !hasValue(value.businessAddressCountryCode)
        ) {
            clientError(
                "RULE_MISSING_BUSINESS_ADDRESS",
                "Address line one and country code are required for self-employment businesses",
            );
        }
        if (
            value.businessAddressCountryCode === "GB"
            && !hasValue(value.businessAddressPostcode)
        ) {
            clientError("MISSING_POSTCODE", "A postcode is required for a GB business address");
        }
    } else {
        if (hasValue(value.tradingName)) {
            clientError("RULE_UNEXPECTED_TRADING_NAME", "tradingName is forbidden for property businesses");
        }
        if (hasAnyAddress) {
            clientError("RULE_UNEXPECTED_BUSINESS_ADDRESS", "Business address fields are forbidden for property businesses");
        }
    }

    return {
        ...withoutNullValues(value),
        ...(value.latencyDetails
            ? { latencyDetails: withoutNullValues(value.latencyDetails) }
            : {}),
        ...(value.quarterlyTypeChoice
            ? { quarterlyTypeChoice: withoutNullValues(value.quarterlyTypeChoice) }
            : {}),
    };
};

const parseHmrcError = (
    statusCode: number,
    responseBody: string,
    correlationId?: string,
): HmrcTestBusinessErrorResponse => {
    try {
        const value = JSON.parse(responseBody) as unknown;
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
        const object = value as Record<string, unknown>;
        if (typeof object.code !== "string") throw new Error();
        return {
            statusCode,
            code: object.code,
            message: typeof object.message === "string"
                ? object.message
                : `HMRC request failed with status ${statusCode}`,
            correlationId,
        };
    } catch {
        return {
            statusCode,
            code: "HMRC_REQUEST_FAILED",
            message: `HMRC request failed with status ${statusCode}`,
            correlationId,
        };
    }
};

const parseCreateResponse = (responseBody: string): CreateTestBusinessResponse => {
    const value = JSON.parse(responseBody) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const businessId = (value as Record<string, unknown>).businessId;
    if (typeof businessId !== "string" || !BUSINESS_ID_REGEX.test(businessId)) {
        throw new Error();
    }
    return { businessId };
};

export const createHmrcTestBusiness = async ({
    accessToken,
    nino,
    business,
}: CreateHmrcTestBusinessOptions): Promise<HmrcTestBusinessResult> => {
    if (!NINO_REGEX.test(nino)) {
        clientError("FORMAT_NINO", "The provided NINO is invalid");
    }

    const payload = validateCreateTestBusinessPayload(business);
    const baseUrl = requiredEnvironmentVariable("HMRC_API_BASE_URL");
    const path = `/individuals/self-assessment-test-support/business/${encodeURIComponent(nino)}`;
    let response: Response;

    try {
        response = await fetch(new URL(path, baseUrl), {
            method: "POST",
            headers: {
                accept: HMRC_TEST_SUPPORT_API_VERSION,
                authorization: `Bearer ${accessToken}`,
                "content-type": "application/json",
            },
            body: JSON.stringify(payload),
        });
    } catch {
        return {
            ok: false,
            error: {
                statusCode: 502,
                code: "HMRC_REQUEST_FAILED",
                message: "Unable to reach HMRC",
            },
        };
    }

    const responseBody = await response.text();
    const correlationId = response.headers.get("X-CorrelationId") ?? undefined;

    if (!response.ok) {
        return {
            ok: false,
            error: parseHmrcError(response.status, responseBody, correlationId),
        };
    }

    try {
        return { ok: true, data: parseCreateResponse(responseBody) };
    } catch {
        return {
            ok: false,
            error: {
                statusCode: 502,
                code: "INVALID_HMRC_RESPONSE",
                message: "HMRC returned an invalid create test business response",
                correlationId,
            },
        };
    }
};
