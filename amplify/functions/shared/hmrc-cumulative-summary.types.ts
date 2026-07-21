export type CumulativeSummaryMode = "consolidated" | "non-consolidated";

export type CumulativePeriodDates = {
    periodStartDate: string;
    periodEndDate: string;
};
export type CumulativePeriodIncome = {
    turnover?: number | null;
    other?: number | null;
    taxTakenOffTradingIncome?: number | null;
};

export type NonConsolidatedPeriodExpenses = {
    costOfGoods?: number | null;
    paymentsToSubcontractors?: number | null;
    wagesAndStaffCosts?: number | null;
    carVanTravelExpenses?: number | null;
    premisesRunningCosts?: number | null;
    maintenanceCosts?: number | null;
    adminCosts?: number | null;
    businessEntertainmentCosts?: number | null;
    advertisingCosts?: number | null;
    interestOnBankOtherLoans?: number | null;
    financeCharges?: number | null;
    irrecoverableDebts?: number | null;
    professionalFees?: number | null;
    depreciation?: number | null;
    otherExpenses?: number | null;
};

export type PeriodDisallowableExpenses = {
    costOfGoodsDisallowable?: number | null;
    paymentsToSubcontractorsDisallowable?: number | null;
    wagesAndStaffCostsDisallowable?: number | null;
    carVanTravelExpensesDisallowable?: number | null;
    premisesRunningCostsDisallowable?: number | null;
    maintenanceCostsDisallowable?: number | null;
    adminCostsDisallowable?: number | null;
    businessEntertainmentCostsDisallowable?: number | null;
    advertisingCostsDisallowable?: number | null;
    interestOnBankOtherLoansDisallowable?: number | null;
    financeChargesDisallowable?: number | null;
    irrecoverableDebtsDisallowable?: number | null;
    professionalFeesDisallowable?: number | null;
    depreciationDisallowable?: number | null;
    otherExpensesDisallowable?: number | null;
};

export type ConsolidatedCumulativeSummaryPayload = {
    periodDates?: CumulativePeriodDates | null;
    periodIncome: CumulativePeriodIncome;
    periodExpenses: {
        consolidatedExpenses: number;
    };
};

export type NonConsolidatedCumulativeSummaryPayload = {
    periodDates?: CumulativePeriodDates | null;
    periodIncome: CumulativePeriodIncome;
    periodExpenses: NonConsolidatedPeriodExpenses;
    periodDisallowableExpenses?: PeriodDisallowableExpenses | null;
};

export type ConsolidatedCumulativeSummary = {
    periodDates: CumulativePeriodDates;
    periodIncome?: CumulativePeriodIncome;
    periodExpenses?: { consolidatedExpenses: number };
};

export type NonConsolidatedCumulativeSummary = {
    periodDates: CumulativePeriodDates;
    periodIncome?: CumulativePeriodIncome;
    periodExpenses?: NonConsolidatedPeriodExpenses;
    periodDisallowableExpenses?: PeriodDisallowableExpenses;
};

export type HmrcCumulativeSummaryErrorResponse = {
    statusCode: number;
    code: string;
    message: string;
    correlationId?: string;
};

export type HmrcCumulativeSummaryResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: HmrcCumulativeSummaryErrorResponse };

export type CumulativeSummaryRequestOptions = {
    accessToken: string;
    path: string;
    govTestScenario?: string | null;
    fraudPreventionHeaders?: string | null;
};
