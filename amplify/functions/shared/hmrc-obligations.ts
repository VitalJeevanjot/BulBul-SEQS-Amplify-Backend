import type {
    BusinessObligations,
    FinalDeclarationObligationsFilters,
    FinalDeclarationObligationsResponse,
    HmrcObligationsErrorResponse,
    HmrcObligationsRequest,
    HmrcObligationsResult,
    IncomeAndExpenditureObligationsFilters,
    IncomeAndExpenditureObligationsResponse,
    ObligationBusinessType,
    ObligationDetail,
    ObligationStatus,
} from "./hmrc-obligations.types";

const HMRC_OBLIGATIONS_API_VERSION = "application/vnd.hmrc.3.0+json";
const NINO_REGEX = /^((?!(BG|GB|KN|NK|NT|TN|ZZ)|(D|F|I|Q|U|V)[A-Z]|[A-Z](D|F|I|O|Q|U|V))[A-Z]{2})[0-9]{6}[A-D]$/;
const BUSINESS_ID_REGEX = /^X[A-Za-z0-9]IS[0-9]{11}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TAX_YEAR_REGEX = /^(\d{4})-(\d{2})$/;
const OBLIGATION_STATUSES = new Set<ObligationStatus>(["open", "fulfilled"]);
const BUSINESS_TYPES = new Set<ObligationBusinessType>([
    "self-employment",
    "uk-property",
    "foreign-property",
]);

export class HmrcObligationsError extends Error {
    readonly statusCode: number;
    readonly code: string;

    constructor(statusCode: number, code: string, message: string) {
        super(message);
        this.name = "HmrcObligationsError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

const requiredEnvironmentVariable = (name: string): string => {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
};

export const assertValidObligationsNino = (nino: string): void => {
    if (!NINO_REGEX.test(nino)) {
        throw new HmrcObligationsError(
            400,
            "FORMAT_NINO",
            "The provided NINO is invalid",
        );
    }
};

const assertValidBusinessType = (typeOfBusiness: string): void => {
    if (!BUSINESS_TYPES.has(typeOfBusiness as ObligationBusinessType)) {
        throw new HmrcObligationsError(
            400,
            "FORMAT_TYPE_OF_BUSINESS",
            "The provided typeOfBusiness field is invalid",
        );
    }
};

const assertValidBusinessId = (businessId: string): void => {
    if (!BUSINESS_ID_REGEX.test(businessId)) {
        throw new HmrcObligationsError(
            400,
            "FORMAT_BUSINESS_ID",
            "The provided businessId is invalid",
        );
    }
};

const parseDate = (value: string, code: string, field: string): number => {
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    const isExactDate = Number.isFinite(timestamp)
        && new Date(timestamp).toISOString().slice(0, 10) === value;

    if (!DATE_REGEX.test(value) || !isExactDate) {
        throw new HmrcObligationsError(
            400,
            code,
            `The provided ${field} is invalid`,
        );
    }

    return timestamp;
};

const assertValidStatus = (status: string): void => {
    if (!OBLIGATION_STATUSES.has(status as ObligationStatus)) {
        throw new HmrcObligationsError(
            400,
            "FORMAT_STATUS",
            "The provided status is invalid",
        );
    }
};

const assertValidTaxYear = (taxYear: string): void => {
    const match = TAX_YEAR_REGEX.exec(taxYear);
    const startYear = match ? Number(match[1]) : Number.NaN;
    const expectedEndYear = Number.isFinite(startYear)
        ? String((startYear + 1) % 100).padStart(2, "0")
        : "";

    if (!match || match[2] !== expectedEndYear) {
        throw new HmrcObligationsError(
            400,
            "FORMAT_TAX_YEAR",
            "The provided tax year is invalid",
        );
    }
};

export const buildIncomeAndExpenditureObligationsPath = (
    nino: string,
    filters: IncomeAndExpenditureObligationsFilters,
): string => {
    assertValidObligationsNino(nino);

    const {
        typeOfBusiness,
        businessId,
        fromDate,
        toDate,
        status,
    } = filters;

    if (typeOfBusiness) assertValidBusinessType(typeOfBusiness);
    if (businessId) assertValidBusinessId(businessId);

    if (businessId && !typeOfBusiness) {
        throw new HmrcObligationsError(
            400,
            "MISSING_TYPE_OF_BUSINESS",
            "The typeOfBusiness query parameter must be provided when businessId is supplied",
        );
    }

    if (fromDate && !toDate) {
        throw new HmrcObligationsError(
            400,
            "MISSING_TO_DATE",
            "The To date parameter is missing",
        );
    }

    if (toDate && !fromDate) {
        throw new HmrcObligationsError(
            400,
            "MISSING_FROM_DATE",
            "The From date parameter is missing",
        );
    }

    if (status) assertValidStatus(status);

    if (fromDate && toDate) {
        const fromTimestamp = parseDate(fromDate, "FORMAT_FROM_DATE", "fromDate");
        const toTimestamp = parseDate(toDate, "FORMAT_TO_DATE", "toDate");

        if (toTimestamp < fromTimestamp) {
            throw new HmrcObligationsError(
                400,
                "RANGE_TO_DATE_BEFORE_FROM_DATE",
                "The To date must be after the From date",
            );
        }

        const daysApart = (toTimestamp - fromTimestamp) / 86_400_000;

        if (daysApart > 366) {
            throw new HmrcObligationsError(
                400,
                "RULE_DATE_RANGE_INVALID",
                "The specified date range is invalid",
            );
        }
    }

    const query = new URLSearchParams();
    if (typeOfBusiness) query.set("typeOfBusiness", typeOfBusiness);
    if (businessId) query.set("businessId", businessId);
    if (fromDate) query.set("fromDate", fromDate);
    if (toDate) query.set("toDate", toDate);
    if (status) query.set("status", status);

    const path = `/obligations/details/${encodeURIComponent(nino)}/income-and-expenditure`;
    return query.size ? `${path}?${query.toString()}` : path;
};

export const buildFinalDeclarationObligationsPath = (
    nino: string,
    filters: FinalDeclarationObligationsFilters,
): string => {
    assertValidObligationsNino(nino);

    const { taxYear, status } = filters;
    if (taxYear) assertValidTaxYear(taxYear);
    if (status) assertValidStatus(status);

    const query = new URLSearchParams();
    if (taxYear) query.set("taxYear", taxYear);
    if (status) query.set("status", status);

    const path = `/obligations/details/${encodeURIComponent(nino)}/crystallisation`;
    return query.size ? `${path}?${query.toString()}` : path;
};

const invalidResponse = (details: string): never => {
    throw new Error(`Invalid HMRC obligations response: ${details}`);
};

const asObject = (value: unknown, field: string): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return invalidResponse(`${field} must be an object`);
    }

    return value as Record<string, unknown>;
};

const requiredString = (
    object: Record<string, unknown>,
    field: string,
): string => {
    const value = object[field];

    if (typeof value !== "string") {
        return invalidResponse(`${field} must be a string`);
    }

    return value;
};

const optionalString = (
    object: Record<string, unknown>,
    field: string,
): string | undefined => {
    const value = object[field];

    if (value === undefined) return undefined;
    if (typeof value !== "string") {
        return invalidResponse(`${field} must be a string`);
    }

    return value;
};

const parseObligationDetail = (value: unknown): ObligationDetail => {
    const object = asObject(value, "obligationDetail");
    const status = requiredString(object, "status");

    if (!OBLIGATION_STATUSES.has(status as ObligationStatus)) {
        return invalidResponse("status must be open or fulfilled");
    }

    return {
        periodStartDate: requiredString(object, "periodStartDate"),
        periodEndDate: requiredString(object, "periodEndDate"),
        dueDate: requiredString(object, "dueDate"),
        status: status as ObligationStatus,
        receivedDate: optionalString(object, "receivedDate"),
    };
};

const parseBusinessObligations = (value: unknown): BusinessObligations => {
    const object = asObject(value, "businessObligations");
    const typeOfBusiness = requiredString(object, "typeOfBusiness");
    const businessId = requiredString(object, "businessId");
    const obligationDetails = object.obligationDetails;

    if (!BUSINESS_TYPES.has(typeOfBusiness as ObligationBusinessType)) {
        return invalidResponse("typeOfBusiness is not supported");
    }

    if (!BUSINESS_ID_REGEX.test(businessId)) {
        return invalidResponse("businessId is invalid");
    }

    if (!Array.isArray(obligationDetails)) {
        return invalidResponse("obligationDetails must be an array");
    }

    return {
        typeOfBusiness: typeOfBusiness as ObligationBusinessType,
        businessId,
        obligationDetails: obligationDetails.map(parseObligationDetail),
    };
};

const parseObligationsArray = (value: unknown): unknown[] => {
    const object = asObject(value, "response");

    if (!Array.isArray(object.obligations)) {
        return invalidResponse("obligations must be an array");
    }

    return object.obligations;
};

export const parseIncomeAndExpenditureObligationsResponse = (
    value: unknown,
): IncomeAndExpenditureObligationsResponse => ({
    obligations: parseObligationsArray(value).map(parseBusinessObligations),
});

export const parseFinalDeclarationObligationsResponse = (
    value: unknown,
): FinalDeclarationObligationsResponse => ({
    obligations: parseObligationsArray(value).map(parseObligationDetail),
});

const parseFraudPreventionHeaders = (
    fraudPreventionHeaders?: string | null,
): Record<string, string> => {
    if (!fraudPreventionHeaders) return {};

    let parsed: unknown;

    try {
        parsed = JSON.parse(fraudPreventionHeaders) as unknown;
    } catch {
        throw new HmrcObligationsError(
            400,
            "FORMAT_FRAUD_PREVENTION_HEADERS",
            "Fraud prevention headers must contain valid JSON",
        );
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new HmrcObligationsError(
            400,
            "FORMAT_FRAUD_PREVENTION_HEADERS",
            "Fraud prevention headers must be a JSON object",
        );
    }

    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => {
        if (typeof value !== "string") {
            throw new HmrcObligationsError(
                400,
                "FORMAT_FRAUD_PREVENTION_HEADERS",
                "Fraud prevention header values must be strings",
            );
        }

        return [key, value];
    }));
};

const parseHmrcError = (
    statusCode: number,
    responseBody: string,
    correlationId?: string,
): HmrcObligationsErrorResponse => {
    try {
        const object = asObject(JSON.parse(responseBody) as unknown, "error");
        const code = requiredString(object, "code");
        const message = optionalString(object, "message")
            ?? `HMRC request failed with status ${statusCode}`;

        return { statusCode, code, message, correlationId };
    } catch {
        return {
            statusCode,
            code: "HMRC_REQUEST_FAILED",
            message: `HMRC request failed with status ${statusCode}`,
            correlationId,
        };
    }
};

export const requestHmrcObligations = async <T>(
    {
        accessToken,
        path,
        govTestScenario,
        fraudPreventionHeaders,
    }: HmrcObligationsRequest,
    parseResponse: (value: unknown) => T,
): Promise<HmrcObligationsResult<T>> => {
    const headers: Record<string, string> = {
        ...parseFraudPreventionHeaders(fraudPreventionHeaders),
        accept: HMRC_OBLIGATIONS_API_VERSION,
        authorization: `Bearer ${accessToken}`,
    };

    if (govTestScenario) headers["Gov-Test-Scenario"] = govTestScenario;

    let response: Response;

    try {
        response = await fetch(new URL(
            path,
            requiredEnvironmentVariable("HMRC_API_BASE_URL"),
        ), {
            method: "GET",
            headers,
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
        return {
            ok: true,
            data: parseResponse(JSON.parse(responseBody) as unknown),
        };
    } catch {
        return {
            ok: false,
            error: {
                statusCode: 502,
                code: "INVALID_HMRC_RESPONSE",
                message: "HMRC returned an invalid obligations response",
                correlationId,
            },
        };
    }
};
