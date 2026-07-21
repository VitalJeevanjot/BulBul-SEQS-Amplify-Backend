import type { AppSyncIdentityCognito } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/put-self-employment-cumulative-summary-non-consolidated";
import type { Schema } from "../../data/resource";
import {
    buildCumulativeSummaryPath,
    HmrcCumulativeSummaryError,
    putHmrcCumulativeSummary,
    validateNonConsolidatedPayload,
    verifySelfEmploymentBusiness,
} from "../shared/hmrc-cumulative-summary";
import { HmrcBusinessDetailsError } from "../shared/hmrc-business-details";
import type { NonConsolidatedCumulativeSummaryPayload } from "../shared/hmrc-cumulative-summary.types";
import {
    getStoredHmrcAccessToken,
    HmrcTokenStoreError,
} from "../shared/persist-hmrc-tokens";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

export const handler: Schema["putSelfEmploymentCumulativeSummaryNonConsolidated"]["functionHandler"] = async (event) => {
    try {
        const { nino, businessId, taxYear, summary, govTestScenario, fraudPreventionHeaders } = event.arguments;
        const identity = event.identity as AppSyncIdentityCognito;
        const path = buildCumulativeSummaryPath(nino, businessId, taxYear);
        const payload = validateNonConsolidatedPayload(summary as NonConsolidatedCumulativeSummaryPayload);
        const accessToken = await getStoredHmrcAccessToken(client, identity);
        const businessCheck = await verifySelfEmploymentBusiness({
            accessToken,
            nino,
            businessId,
            fraudPreventionHeaders,
        });

        if (!businessCheck.ok) return { success: false, error: businessCheck.error };

        const result = await putHmrcCumulativeSummary({
            accessToken,
            path,
            govTestScenario,
            fraudPreventionHeaders,
        }, payload);
        return result.ok
            ? { success: true, data: result.data }
            : { success: false, error: result.error };
    } catch (error) {
        if (
            error instanceof HmrcCumulativeSummaryError
            || error instanceof HmrcBusinessDetailsError
            || error instanceof HmrcTokenStoreError
        ) {
            return {
                success: false,
                error: { statusCode: error.statusCode, code: error.code, message: error.message },
            };
        }
        return {
            success: false,
            error: {
                statusCode: 500,
                code: "CUMULATIVE_SUMMARY_REQUEST_FAILED",
                message: "Unable to create or amend the non-consolidated cumulative period summary",
            },
        };
    }
};
