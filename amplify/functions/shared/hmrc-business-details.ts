import type {
    AccountingPeriod,
    BusinessDetails,
    BusinessSummary,
    BusinessType,
    HmrcApiError,
    HmrcBusinessDetailsRequest,
    HmrcBusinessDetailsResult,
    LatencyDetails,
    ListBusinessesResponse,
    QuarterlyTypeChoice,
} from "./hmrc-business-details.types";

const hmrcBusinessDetailsApiVersion = "application/vnd.hmrc.2.0+json";

export class HmrcBusinessDetailsError extends Error {
    readonly statusCode: number;
    readonly code: string;

    constructor(statusCode: number, code: string, message: string) {
        super(message);
        this.name = "HmrcBusinessDetailsError";
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

const ninoRegex = /^((?!(BG|GB|KN|NK|NT|TN|ZZ)|(D|F|I|Q|U|V)[A-Z]|[A-Z](D|F|I|O|Q|U|V))[A-Z]{2})[0-9]{6}[A-D]$/;
const businessIdRegex = /^X[A-Z0-9]{1}IS[0-9]{11}$/;

export const assertValidNino = (nino: string): void => {
    if (!ninoRegex.test(nino)) {
        throw new HmrcBusinessDetailsError(
            400,
            "FORMAT_NINO",
            "The provided NINO is invalid",
        );
    }
};

export const assertValidBusinessId = (businessId: string): void => {
    if (!businessIdRegex.test(businessId)) {
        throw new HmrcBusinessDetailsError(
            400,
            "FORMAT_BUSINESS_ID",
            "The provided Business ID is invalid",
        );
    }
};

const parseFraudPreventionHeaders = (
    fraudPreventionHeaders?: string | null,
): Record<string, string> => {
    if (!fraudPreventionHeaders) {
        return {};
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(fraudPreventionHeaders) as unknown;
    } catch {
        throw new HmrcBusinessDetailsError(
            400,
            "FORMAT_FRAUD_PREVENTION_HEADERS",
            "Fraud prevention headers must contain valid JSON",
        );
    }

    if (
        !parsed
        || typeof parsed !== "object"
        || Array.isArray(parsed)
    ) {
        throw new HmrcBusinessDetailsError(
            400,
            "FORMAT_FRAUD_PREVENTION_HEADERS",
            "Fraud prevention headers must be a JSON object",
        );
    }

    return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => {
            if (typeof value !== "string") {
                throw new HmrcBusinessDetailsError(
                    400,
                    "FORMAT_FRAUD_PREVENTION_HEADERS",
                    "Fraud prevention header values must be strings",
                );
            }

            return [key, value];
        }),
    );
};

const businessTypes = new Set<BusinessType>([
    "self-employment",
    "uk-property",
    "foreign-property",
    "property-unspecified",
]);

const invalidResponse = (details: string): never => {
    throw new Error(`Invalid HMRC response: ${details}`);
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

    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== "string") {
        return invalidResponse(`${field} must be a string`);
    }

    return value;
};

const parseBusinessType = (
    object: Record<string, unknown>,
): BusinessType => {
    const value = requiredString(object, "typeOfBusiness");

    if (!businessTypes.has(value as BusinessType)) {
        return invalidResponse("typeOfBusiness is not supported");
    }

    return value as BusinessType;
};

const parseBusinessSummary = (value: unknown): BusinessSummary => {
    const object = asObject(value, "business");

    return {
        typeOfBusiness: parseBusinessType(object),
        businessId: requiredString(object, "businessId"),
        tradingName: optionalString(object, "tradingName"),
    };
};

export const parseListBusinessesResponse = (
    value: unknown,
): ListBusinessesResponse => {
    const object = asObject(value, "response");
    const listOfBusinesses = object.listOfBusinesses;

    if (!Array.isArray(listOfBusinesses)) {
        return invalidResponse("listOfBusinesses must be an array");
    }

    return {
        listOfBusinesses: listOfBusinesses.map(parseBusinessSummary),
    };
};

const parseLatencyDetails = (value: unknown): LatencyDetails => {
    const object = asObject(value, "latencyDetails");
    const latencyIndicator1 = requiredString(object, "latencyIndicator1");
    const latencyIndicator2 = requiredString(object, "latencyIndicator2");

    if (
        !["A", "Q"].includes(latencyIndicator1)
        || !["A", "Q"].includes(latencyIndicator2)
    ) {
        return invalidResponse("latency indicators must be A or Q");
    }

    return {
        latencyEndDate: requiredString(object, "latencyEndDate"),
        taxYear1: requiredString(object, "taxYear1"),
        latencyIndicator1: latencyIndicator1 as "A" | "Q",
        taxYear2: requiredString(object, "taxYear2"),
        latencyIndicator2: latencyIndicator2 as "A" | "Q",
    };
};

const parseQuarterlyTypeChoice = (value: unknown): QuarterlyTypeChoice => {
    const object = asObject(value, "quarterlyTypeChoice");
    const quarterlyPeriodType = optionalString(object, "quarterlyPeriodType");

    if (
        quarterlyPeriodType !== undefined
        && !["standard", "calendar"].includes(quarterlyPeriodType)
    ) {
        return invalidResponse("quarterlyPeriodType is not supported");
    }

    return {
        quarterlyPeriodType: quarterlyPeriodType as
            | "standard"
            | "calendar"
            | undefined,
        taxYearOfChoice: optionalString(object, "taxYearOfChoice"),
    };
};

const parseAccountingPeriods = (value: unknown): AccountingPeriod[] => {
    if (!Array.isArray(value)) {
        return invalidResponse("accountingPeriods must be an array");
    }

    return value.map((period) => {
        const object = asObject(period, "accountingPeriod");

        return {
            start: requiredString(object, "start"),
            end: requiredString(object, "end"),
        };
    });
};

export const parseBusinessDetailsResponse = (value: unknown): BusinessDetails => {
    const object = asObject(value, "response");
    const latencyDetails = object.latencyDetails === undefined
        ? undefined
        : parseLatencyDetails(object.latencyDetails);
    const quarterlyTypeChoice = object.quarterlyTypeChoice === undefined
        ? undefined
        : parseQuarterlyTypeChoice(object.quarterlyTypeChoice);
    const accountingPeriods = object.accountingPeriods === undefined
        ? undefined
        : parseAccountingPeriods(object.accountingPeriods);

    return {
        businessId: requiredString(object, "businessId"),
        typeOfBusiness: parseBusinessType(object),
        tradingName: optionalString(object, "tradingName"),
        yearOfMigration: optionalString(object, "yearOfMigration"),
        firstAccountingPeriodStartDate: optionalString(
            object,
            "firstAccountingPeriodStartDate",
        ),
        firstAccountingPeriodEndDate: optionalString(
            object,
            "firstAccountingPeriodEndDate",
        ),
        latencyDetails,
        quarterlyTypeChoice,
        accountingPeriods,
        commencementDate: optionalString(object, "commencementDate"),
        cessationDate: optionalString(object, "cessationDate"),
        businessAddressLineOne: optionalString(object, "businessAddressLineOne"),
        businessAddressLineTwo: optionalString(object, "businessAddressLineTwo"),
        businessAddressLineThree: optionalString(object, "businessAddressLineThree"),
        businessAddressLineFour: optionalString(object, "businessAddressLineFour"),
        businessAddressPostcode: optionalString(object, "businessAddressPostcode"),
        businessAddressCountryCode: optionalString(
            object,
            "businessAddressCountryCode",
        ),
    };
};

const parseHmrcError = (
    statusCode: number,
    responseBody: string,
    correlationId?: string,
): HmrcApiError => {
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

export const requestHmrcBusinessDetails = async <T>(
    {
        accessToken,
        path,
        govTestScenario,
        fraudPreventionHeaders,
    }: HmrcBusinessDetailsRequest,
    parseResponse: (value: unknown) => T,
): Promise<HmrcBusinessDetailsResult<T>> => {
    const headers: Record<string, string> = {
        accept: hmrcBusinessDetailsApiVersion,
        authorization: `Bearer ${accessToken}`,
        ...parseFraudPreventionHeaders(fraudPreventionHeaders),
    };

    if (govTestScenario) {
        headers["Gov-Test-Scenario"] = govTestScenario;
    }

    const baseUrl = requiredEnvironmentVariable("HMRC_API_BASE_URL");
    let response: Response;

    try {
        response = await fetch(new URL(path, baseUrl), {
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
                message: "HMRC returned an invalid business details response",
                correlationId,
            },
        };
    }
};
