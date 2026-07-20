import { a } from '@aws-amplify/backend';

export const customTypes = {
  BusinessSummary: a.customType({
    typeOfBusiness: a.string().required(),
    businessId: a.string().required(),
    tradingName: a.string(),
  }),
  ListBusinessesResponse: a.customType({
    listOfBusinesses: a.ref('BusinessSummary').array().required(),
  }),
  AccountingPeriod: a.customType({
    start: a.date().required(),
    end: a.date().required(),
  }),
  LatencyDetails: a.customType({
    latencyEndDate: a.date().required(),
    taxYear1: a.string().required(),
    latencyIndicator1: a.string().required(),
    taxYear2: a.string().required(),
    latencyIndicator2: a.string().required(),
  }),
  QuarterlyTypeChoice: a.customType({
    quarterlyPeriodType: a.string(),
    taxYearOfChoice: a.string(),
  }),
  BusinessDetails: a.customType({
    businessId: a.string().required(),
    typeOfBusiness: a.string().required(),
    tradingName: a.string(),
    yearOfMigration: a.string(),
    firstAccountingPeriodStartDate: a.date(),
    firstAccountingPeriodEndDate: a.date(),
    latencyDetails: a.ref('LatencyDetails'),
    quarterlyTypeChoice: a.ref('QuarterlyTypeChoice'),
    accountingPeriods: a.ref('AccountingPeriod').array(),
    commencementDate: a.date(),
    cessationDate: a.date(),
    businessAddressLineOne: a.string(),
    businessAddressLineTwo: a.string(),
    businessAddressLineThree: a.string(),
    businessAddressLineFour: a.string(),
    businessAddressPostcode: a.string(),
    businessAddressCountryCode: a.string(),
  }),
  HmrcApiError: a.customType({
    statusCode: a.integer().required(),
    code: a.string().required(),
    message: a.string().required(),
    correlationId: a.string(),
  }),
  HmrcOAuthTokenMetadata: a.customType({
    tokenType: a.string().required(),
    expiresIn: a.integer().required(),
    expiresAt: a.datetime().required(),
    scope: a.string(),
  }),
  HmrcOAuthError: a.customType({
    statusCode: a.integer().required(),
    error: a.string().required(),
    errorDescription: a.string().required(),
  }),
  HmrcOAuthTokenResult: a.customType({
    success: a.boolean().required(),
    token: a.ref('HmrcOAuthTokenMetadata'),
    error: a.ref('HmrcOAuthError'),
  }),
  ListBusinessesResult: a.customType({
    success: a.boolean().required(),
    data: a.ref('ListBusinessesResponse'),
    error: a.ref('HmrcApiError'),
  }),
  RetrieveBusinessDetailsResult: a.customType({
    success: a.boolean().required(),
    data: a.ref('BusinessDetails'),
    error: a.ref('HmrcApiError'),
  }),
  HmrcTokenStatus: a.customType({
    hasAccessToken: a.boolean().required(),
    hasRefreshToken: a.boolean().required(),
    isSignedInWithHmrc: a.boolean().required(),
  }),
  HmrcTokenStatusResult: a.customType({
    success: a.boolean().required(),
    data: a.ref('HmrcTokenStatus'),
    error: a.ref('HmrcApiError'),
  }),
  HmrcNinoCheck: a.customType({
    isValid: a.boolean().required(),
  }),
  HmrcNinoCheckResult: a.customType({
    success: a.boolean().required(),
    data: a.ref('HmrcNinoCheck'),
    error: a.ref('HmrcApiError'),
  }),
  SignedInUserDetails: a.customType({
    userId: a.string().required(),
    username: a.string().required(),
    email: a.email(),
    hmrcTokenStatus: a.ref('HmrcTokenStatus').required(),
  }),
  SignedInUserDetailsResult: a.customType({
    success: a.boolean().required(),
    data: a.ref('SignedInUserDetails'),
    error: a.ref('HmrcApiError'),
  }),
};
