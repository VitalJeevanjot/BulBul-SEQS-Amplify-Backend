import {
    parseBusinessDetailsResponse,
    requestHmrcBusinessDetails,
} from "./hmrc-business-details";
import type {
    ConsolidatedCumulativeSummary,
    ConsolidatedCumulativeSummaryPayload,
    CumulativePeriodDates,
    CumulativePeriodIncome,
    CumulativeSummaryRequestOptions,
    HmrcCumulativeSummaryErrorResponse,
    HmrcCumulativeSummaryResult,
    NonConsolidatedCumulativeSummary,
    NonConsolidatedCumulativeSummaryPayload,
    NonConsolidatedPeriodExpenses,
    PeriodDisallowableExpenses,
} from "./hmrc-cumulative-summary.types";

const HMRC_CUMULATIVE_SUMMARY_API_VERSION = "application/vnd.hmrc.5.0+json";
const NINO_REGEX = /^((?!(BG|GB|KN|NK|NT|TN|ZZ)|(D|F|I|Q|U|V)[A-Z]|[A-Z](D|F|I|O|Q|U|V))[A-Z]{2})[0-9]{6}[A-D]$/;
const BUSINESS_ID_REGEX = /^X[A-Z0-9]IS[0-9]{11}$/;
const TAX_YEAR_REGEX = /^(\d{4})-(\d{2})$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 99_999_999_999.99;

const INCOME_FIELDS = [
    "turnover",
    "other",
    "taxTakenOffTradingIncome",
] as const;

const EXPENSE_FIELDS = [
    "costOfGoods",
    "paymentsToSubcontractors",
    "wagesAndStaffCosts",
    "carVanTravelExpenses",
    "premisesRunningCosts",
    "maintenanceCosts",
    "adminCosts",
    "businessEntertainmentCosts",
    "advertisingCosts",
    "interestOnBankOtherLoans",
    "financeCharges",
    "irrecoverableDebts",
    "professionalFees",
    "depreciation",
    "otherExpenses",
] as const;

const DISALLOWABLE_EXPENSE_FIELDS = [
    "costOfGoodsDisallowable",
    "paymentsToSubcontractorsDisallowable",
    "wagesAndStaffCostsDisallowable",
    "carVanTravelExpensesDisallowable",
    "premisesRunningCostsDisallowable",
    "maintenanceCostsDisallowable",
    "adminCostsDisallowable",
    "businessEntertainmentCostsDisallowable",
    "advertisingCostsDisallowable",
    "interestOnBankOtherLoansDisallowable",
    "financeChargesDisallowable",
    "irrecoverableDebtsDisallowable",
    "professionalFeesDisallowable",
    "depreciationDisallowable",
    "otherExpensesDisallowable",
] as const;

export class HmrcCumulativeSummaryError extends Error {
    readonly statusCode: number;
    readonly code: string;

    constructor(statusCode: number, code: string, message: string) {
        super(message);
        this.name = "HmrcCumulativeSummaryError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

const requiredEnvironmentVariable = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
};

export const buildCumulativeSummaryPath = (
    nino: string,
    businessId: string,
    taxYear: string,
): string => {
    if (!NINO_REGEX.test(nino)) {
        throw new HmrcCumulativeSummaryError(400, "FORMAT_NINO", "The provided NINO is invalid");
    }

    if (!BUSINESS_ID_REGEX.test(businessId)) {
        throw new HmrcCumulativeSummaryError(400, "FORMAT_BUSINESS_ID", "The provided Business ID is invalid");
    }

    const match = TAX_YEAR_REGEX.exec(taxYear);
    const startYear = match ? Number(match[1]) : Number.NaN;
    const expectedEndYear = Number.isFinite(startYear)
        ? String((startYear + 1) % 100).padStart(2, "0")
        : "";

    if (!match || match[2] !== expectedEndYear) {
        throw new HmrcCumulativeSummaryError(400, "FORMAT_TAX_YEAR", "The provided tax year is invalid");
    }

    if (startYear < 2025) {
        throw new HmrcCumulativeSummaryError(
            400,
            "RULE_TAX_YEAR_NOT_SUPPORTED",
            "The tax year must be 2025-26 or later",
        );
    }

    return "/individuals/business/self-employment"
        + `/${encodeURIComponent(nino)}`
        + `/${encodeURIComponent(businessId)}`
        + `/cumulative/${encodeURIComponent(taxYear)}`;
};

const validDate = (value: string): boolean => {
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return DATE_REGEX.test(value)
        && Number.isFinite(timestamp)
        && new Date(timestamp).toISOString().slice(0, 10) === value;
};

const validatePeriodDates = (
    value?: CumulativePeriodDates | null,
): CumulativePeriodDates | undefined => {
    if (!value) return undefined;
    if (!validDate(value.periodStartDate)) {
        throw new HmrcCumulativeSummaryError(400, "FORMAT_START_DATE", "The provided period start date is invalid");
    }
    if (!validDate(value.periodEndDate)) {
        throw new HmrcCumulativeSummaryError(400, "FORMAT_END_DATE", "The provided period end date is invalid");
    }
    if (value.periodEndDate < value.periodStartDate) {
        throw new HmrcCumulativeSummaryError(
            400,
            "RULE_END_DATE_BEFORE_START_DATE",
            "The period end date must not be before the period start date",
        );
    }
    return value;
};

const isTwoDecimalAmount = (value: number): boolean =>
    Number.isFinite(value)
    && Math.abs(value * 100 - Math.round(value * 100)) < 0.000_001;

const validateAmount = (
    value: unknown,
    field: string,
    minimum: number,
): number => {
    if (
        typeof value !== "number"
        || !isTwoDecimalAmount(value)
        || value < minimum
        || value > MAX_AMOUNT
    ) {
        throw new HmrcCumulativeSummaryError(
            400,
            "FORMAT_VALUE",
            `${field} must be between ${minimum} and ${MAX_AMOUNT} with no more than 2 decimal places`,
        );
    }
    return value;
};

const cleanAmounts = <T extends Record<string, number | null | undefined>>(
    value: T,
    fields: readonly (keyof T)[],
    minimum: number,
): Partial<T> => {
    const result: Partial<T> = {};
    for (const field of fields) {
        const amount = value[field];
        if (amount === undefined || amount === null) continue;
        result[field] = validateAmount(amount, String(field), minimum) as T[keyof T];
    }
    return result;
};

const validateIncome = (value: CumulativePeriodIncome): CumulativePeriodIncome => {
    const cleaned = cleanAmounts(value, INCOME_FIELDS, 0);
    if (cleaned.turnover === undefined || cleaned.other === undefined) {
        throw new HmrcCumulativeSummaryError(
            400,
            "RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED",
            "periodIncome must include turnover and other, using zero when there is no income",
        );
    }
    return cleaned;
};

export const validateConsolidatedPayload = (
    value: ConsolidatedCumulativeSummaryPayload,
): ConsolidatedCumulativeSummaryPayload => {
    const periodDates = validatePeriodDates(value.periodDates);
    const periodIncome = validateIncome(value.periodIncome);
    const consolidatedExpenses = validateAmount(
        value.periodExpenses?.consolidatedExpenses,
        "consolidatedExpenses",
        -MAX_AMOUNT,
    );

    return {
        ...(periodDates ? { periodDates } : {}),
        periodIncome,
        periodExpenses: { consolidatedExpenses },
    };
};

export const validateNonConsolidatedPayload = (
    value: NonConsolidatedCumulativeSummaryPayload,
): NonConsolidatedCumulativeSummaryPayload => {
    const periodDates = validatePeriodDates(value.periodDates);
    const periodIncome = validateIncome(value.periodIncome);
    const periodExpenses = cleanAmounts(
        value.periodExpenses ?? {},
        EXPENSE_FIELDS,
        -MAX_AMOUNT,
    ) as NonConsolidatedPeriodExpenses;

    if (!Object.keys(periodExpenses).length) {
        throw new HmrcCumulativeSummaryError(
            400,
            "RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED",
            "periodExpenses must include at least one non-consolidated expense value",
        );
    }

    const periodDisallowableExpenses = value.periodDisallowableExpenses
        ? cleanAmounts(
            value.periodDisallowableExpenses,
            DISALLOWABLE_EXPENSE_FIELDS,
            -MAX_AMOUNT,
        ) as PeriodDisallowableExpenses
        : undefined;

    if (value.periodDisallowableExpenses && !Object.keys(periodDisallowableExpenses ?? {}).length) {
        throw new HmrcCumulativeSummaryError(
            400,
            "RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED",
            "periodDisallowableExpenses must not be empty when supplied",
        );
    }

    return {
        ...(periodDates ? { periodDates } : {}),
        periodIncome,
        periodExpenses,
        ...(periodDisallowableExpenses ? { periodDisallowableExpenses } : {}),
    };
};

const parseFraudPreventionHeaders = (
    fraudPreventionHeaders?: string | null,
): Record<string, string> => {
    if (!fraudPreventionHeaders) return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(fraudPreventionHeaders) as unknown;
    } catch {
        throw new HmrcCumulativeSummaryError(
            400,
            "FORMAT_FRAUD_PREVENTION_HEADERS",
            "Fraud prevention headers must contain valid JSON",
        );
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new HmrcCumulativeSummaryError(
            400,
            "FORMAT_FRAUD_PREVENTION_HEADERS",
            "Fraud prevention headers must be a JSON object",
        );
    }
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => {
        if (typeof value !== "string") {
            throw new HmrcCumulativeSummaryError(
                400,
                "FORMAT_FRAUD_PREVENTION_HEADERS",
                "Fraud prevention header values must be strings",
            );
        }
        return [key, value];
    }));
};

const invalidResponse = (details: string): never => {
    throw new Error(`Invalid HMRC cumulative summary response: ${details}`);
};

const asObject = (value: unknown, field: string): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return invalidResponse(`${field} must be an object`);
    }
    return value as Record<string, unknown>;
};

const requiredString = (object: Record<string, unknown>, field: string): string => {
    const value = object[field];
    if (typeof value !== "string") return invalidResponse(`${field} must be a string`);
    return value;
};

const parseDates = (value: unknown): CumulativePeriodDates => {
    const object = asObject(value, "periodDates");
    const dates = {
        periodStartDate: requiredString(object, "periodStartDate"),
        periodEndDate: requiredString(object, "periodEndDate"),
    };
    if (!validDate(dates.periodStartDate) || !validDate(dates.periodEndDate)) {
        return invalidResponse("periodDates contains an invalid date");
    }
    return dates;
};

const parseOptionalAmounts = <T extends Record<string, number | null | undefined>>(
    value: unknown,
    fieldName: string,
    fields: readonly (keyof T)[],
    minimum: number,
): Partial<T> => {
    const object = asObject(value, fieldName);
    const result: Partial<T> = {};
    for (const field of fields) {
        const amount = object[String(field)];
        if (amount === undefined) continue;
        if (typeof amount !== "number" || !isTwoDecimalAmount(amount) || amount < minimum || amount > MAX_AMOUNT) {
            return invalidResponse(`${String(field)} is invalid`);
        }
        result[field] = amount as T[keyof T];
    }
    return result;
};

const parseIncome = (value: unknown): CumulativePeriodIncome =>
    parseOptionalAmounts<CumulativePeriodIncome>(value, "periodIncome", INCOME_FIELDS, 0);

const parseError = (
    statusCode: number,
    responseBody: string,
    correlationId?: string,
): HmrcCumulativeSummaryErrorResponse => {
    try {
        const object = asObject(JSON.parse(responseBody) as unknown, "error");
        const code = requiredString(object, "code");
        const message = typeof object.message === "string"
            ? object.message
            : `HMRC request failed with status ${statusCode}`;
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

const requestHeaders = (
    options: CumulativeSummaryRequestOptions,
    hasBody: boolean,
): Record<string, string> => {
    const headers: Record<string, string> = {
        ...parseFraudPreventionHeaders(options.fraudPreventionHeaders),
        accept: HMRC_CUMULATIVE_SUMMARY_API_VERSION,
        authorization: `Bearer ${options.accessToken}`,
        ...(hasBody ? { "content-type": "application/json" } : {}),
    };
    if (options.govTestScenario) headers["Gov-Test-Scenario"] = options.govTestScenario;
    return headers;
};

export const verifySelfEmploymentBusiness = async (
    options: Pick<
        CumulativeSummaryRequestOptions,
        "accessToken" | "fraudPreventionHeaders"
    > & { nino: string; businessId: string },
): Promise<HmrcCumulativeSummaryResult<true>> => {
    const result = await requestHmrcBusinessDetails({
        accessToken: options.accessToken,
        path: `/individuals/business/details/${encodeURIComponent(options.nino)}/${encodeURIComponent(options.businessId)}`,
        fraudPreventionHeaders: options.fraudPreventionHeaders,
    }, parseBusinessDetailsResponse);

    if (!result.ok) return result;
    if (result.data.typeOfBusiness !== "self-employment") {
        return {
            ok: false,
            error: {
                statusCode: 400,
                code: "RULE_BUSINESS_NOT_SELF_EMPLOYMENT",
                message: "The provided Business ID does not belong to a self-employment business",
            },
        };
    }
    return { ok: true, data: true };
};

export const putHmrcCumulativeSummary = async (
    options: CumulativeSummaryRequestOptions,
    payload: ConsolidatedCumulativeSummaryPayload | NonConsolidatedCumulativeSummaryPayload,
): Promise<HmrcCumulativeSummaryResult<{ correlationId?: string }>> => {
    let response: Response;
    try {
        response = await fetch(new URL(options.path, requiredEnvironmentVariable("HMRC_API_BASE_URL")), {
            method: "PUT",
            headers: requestHeaders(options, true),
            body: JSON.stringify(payload),
        });
    } catch {
        return { ok: false, error: { statusCode: 502, code: "HMRC_REQUEST_FAILED", message: "Unable to reach HMRC" } };
    }

    const responseBody = await response.text();
    const correlationId = response.headers.get("X-CorrelationId") ?? undefined;
    if (!response.ok) {
        return { ok: false, error: parseError(response.status, responseBody, correlationId) };
    }
    return { ok: true, data: { correlationId } };
};

const parseConsolidatedResponse = (value: unknown): ConsolidatedCumulativeSummary => {
    const object = asObject(value, "response");
    const periodExpenses = object.periodExpenses === undefined
        ? undefined
        : (() => {
            const expenses = asObject(object.periodExpenses, "periodExpenses");
            if (expenses.consolidatedExpenses === undefined) {
                return invalidResponse("consolidatedExpenses is missing");
            }
            if (EXPENSE_FIELDS.some((field) => expenses[field] !== undefined)) {
                return invalidResponse("consolidated and non-consolidated expenses were both returned");
            }
            return {
                consolidatedExpenses: validateAmount(
                    expenses.consolidatedExpenses,
                    "consolidatedExpenses",
                    -MAX_AMOUNT,
                ),
            };
        })();
    return {
        periodDates: parseDates(object.periodDates),
        ...(object.periodIncome === undefined ? {} : { periodIncome: parseIncome(object.periodIncome) }),
        ...(periodExpenses ? { periodExpenses } : {}),
    };
};

const parseNonConsolidatedResponse = (value: unknown): NonConsolidatedCumulativeSummary => {
    const object = asObject(value, "response");
    const periodExpenses = object.periodExpenses === undefined
        ? undefined
        : parseOptionalAmounts<NonConsolidatedPeriodExpenses>(
            object.periodExpenses,
            "periodExpenses",
            EXPENSE_FIELDS,
            -MAX_AMOUNT,
        );
    if (
        object.periodExpenses !== undefined
        && asObject(object.periodExpenses, "periodExpenses").consolidatedExpenses !== undefined
    ) {
        return invalidResponse("a consolidated summary was returned for a non-consolidated request");
    }
    const periodDisallowableExpenses = object.periodDisallowableExpenses === undefined
        ? undefined
        : parseOptionalAmounts<PeriodDisallowableExpenses>(
            object.periodDisallowableExpenses,
            "periodDisallowableExpenses",
            DISALLOWABLE_EXPENSE_FIELDS,
            -MAX_AMOUNT,
        );
    return {
        periodDates: parseDates(object.periodDates),
        ...(object.periodIncome === undefined ? {} : { periodIncome: parseIncome(object.periodIncome) }),
        ...(periodExpenses ? { periodExpenses } : {}),
        ...(periodDisallowableExpenses ? { periodDisallowableExpenses } : {}),
    };
};

export const getHmrcCumulativeSummary = async <T extends ConsolidatedCumulativeSummary | NonConsolidatedCumulativeSummary>(
    options: CumulativeSummaryRequestOptions,
    mode: "consolidated" | "non-consolidated",
): Promise<HmrcCumulativeSummaryResult<T>> => {
    let response: Response;
    try {
        response = await fetch(new URL(options.path, requiredEnvironmentVariable("HMRC_API_BASE_URL")), {
            method: "GET",
            headers: requestHeaders(options, false),
        });
    } catch {
        return { ok: false, error: { statusCode: 502, code: "HMRC_REQUEST_FAILED", message: "Unable to reach HMRC" } };
    }

    const responseBody = await response.text();
    const correlationId = response.headers.get("X-CorrelationId") ?? undefined;
    if (!response.ok) {
        return { ok: false, error: parseError(response.status, responseBody, correlationId) };
    }

    try {
        const parsed = JSON.parse(responseBody) as unknown;
        const data = mode === "consolidated"
            ? parseConsolidatedResponse(parsed)
            : parseNonConsolidatedResponse(parsed);
        return { ok: true, data: data as T };
    } catch {
        return {
            ok: false,
            error: {
                statusCode: 502,
                code: "INVALID_HMRC_RESPONSE",
                message: "HMRC returned an invalid cumulative period summary response",
                correlationId,
            },
        };
    }
};
