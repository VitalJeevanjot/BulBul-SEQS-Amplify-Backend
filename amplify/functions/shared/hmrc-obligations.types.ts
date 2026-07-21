export type ObligationStatus = "open" | "fulfilled";

export type ObligationBusinessType =
    | "self-employment"
    | "uk-property"
    | "foreign-property";

export type ObligationDetail = {
    periodStartDate: string;
    periodEndDate: string;
    dueDate: string;
    status: ObligationStatus;
    receivedDate?: string;
};

export type BusinessObligations = {
    typeOfBusiness: ObligationBusinessType;
    businessId: string;
    obligationDetails: ObligationDetail[];
};

export type IncomeAndExpenditureObligationsResponse = {
    obligations: BusinessObligations[];
};

export type FinalDeclarationObligationsResponse = {
    obligations: ObligationDetail[];
};

export type HmrcObligationsErrorResponse = {
    statusCode: number;
    code: string;
    message: string;
    correlationId?: string;
};

export type HmrcObligationsResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: HmrcObligationsErrorResponse };

export type HmrcObligationsRequest = {
    accessToken: string;
    path: string;
    govTestScenario?: string | null;
    fraudPreventionHeaders?: string | null;
};

export type IncomeAndExpenditureObligationsFilters = {
    typeOfBusiness?: string | null;
    businessId?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    status?: string | null;
};

export type FinalDeclarationObligationsFilters = {
    taxYear?: string | null;
    status?: string | null;
};
