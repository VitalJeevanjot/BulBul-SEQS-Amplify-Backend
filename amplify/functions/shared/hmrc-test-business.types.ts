export type TestBusinessType =
    | "self-employment"
    | "uk-property"
    | "foreign-property"
    | "property-unspecified";

export type TestBusinessLatencyDetails = {
    latencyEndDate: string;
    taxYear1: string;
    latencyIndicator1: "A" | "Q";
    taxYear2: string;
    latencyIndicator2: "A" | "Q";
};

export type TestBusinessQuarterlyTypeChoice = {
    quarterlyPeriodType: "standard" | "calendar";
    taxYearOfChoice: string;
};

export type CreateTestBusinessPayload = {
    typeOfBusiness: TestBusinessType;
    tradingName?: string | null;
    firstAccountingPeriodStartDate?: string | null;
    firstAccountingPeriodEndDate?: string | null;
    latencyDetails?: TestBusinessLatencyDetails | null;
    quarterlyTypeChoice?: TestBusinessQuarterlyTypeChoice | null;
    accountingType?: "CASH" | "ACCRUALS" | null;
    commencementDate?: string | null;
    cessationDate?: string | null;
    businessAddressLineOne?: string | null;
    businessAddressLineTwo?: string | null;
    businessAddressLineThree?: string | null;
    businessAddressLineFour?: string | null;
    businessAddressPostcode?: string | null;
    businessAddressCountryCode?: string | null;
};

export type CreateTestBusinessResponse = {
    businessId: string;
};

export type HmrcTestBusinessErrorResponse = {
    statusCode: number;
    code: string;
    message: string;
    correlationId?: string;
};

export type HmrcTestBusinessResult =
    | { ok: true; data: CreateTestBusinessResponse }
    | { ok: false; error: HmrcTestBusinessErrorResponse };

export type CreateHmrcTestBusinessOptions = {
    accessToken: string;
    nino: string;
    business: CreateTestBusinessPayload;
};
