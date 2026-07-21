export type BusinessType =
    | "self-employment"
    | "uk-property"
    | "foreign-property"
    | "property-unspecified";

export type BusinessSummary = {
    typeOfBusiness: BusinessType;
    businessId: string;
    tradingName?: string;
};

export type ListBusinessesResponse = {
    listOfBusinesses: BusinessSummary[];
};

export type AccountingPeriod = {
    start: string;
    end: string;
};

export type LatencyDetails = {
    latencyEndDate: string;
    taxYear1: string;
    latencyIndicator1: "A" | "Q";
    taxYear2: string;
    latencyIndicator2: "A" | "Q";
};

export type QuarterlyTypeChoice = {
    quarterlyPeriodType?: "standard" | "calendar";
    taxYearOfChoice?: string;
};

export type BusinessDetails = {
    businessId: string;
    typeOfBusiness: BusinessType;
    tradingName?: string;
    yearOfMigration?: string;
    firstAccountingPeriodStartDate?: string;
    firstAccountingPeriodEndDate?: string;
    latencyDetails?: LatencyDetails;
    quarterlyTypeChoice?: QuarterlyTypeChoice;
    accountingPeriods?: AccountingPeriod[];
    commencementDate?: string;
    cessationDate?: string;
    businessAddressLineOne?: string;
    businessAddressLineTwo?: string;
    businessAddressLineThree?: string;
    businessAddressLineFour?: string;
    businessAddressPostcode?: string;
    businessAddressCountryCode?: string;
};

export type HmrcApiError = {
    statusCode: number;
    code: string;
    message: string;
    correlationId?: string;
};

export type HmrcBusinessDetailsResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: HmrcApiError };

export type HmrcBusinessDetailsRequest = {
    accessToken: string;
    path: string;
    govTestScenario?: string | null;
    fraudPreventionHeaders?: string | null;
};
