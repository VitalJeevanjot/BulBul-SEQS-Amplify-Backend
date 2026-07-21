import type { AppSyncIdentityCognito } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/get-self-employment-cumulative-summary-non-consolidated";
import type { Schema } from "../../data/resource";
import {
    buildCumulativeSummaryPath,
    getHmrcCumulativeSummary,
    HmrcCumulativeSummaryError,
} from "../shared/hmrc-cumulative-summary";
import type { NonConsolidatedCumulativeSummary } from "../shared/hmrc-cumulative-summary.types";
import {
    getStoredHmrcAccessToken,
    HmrcTokenStoreError,
} from "../shared/persist-hmrc-tokens";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

export const handler: Schema["getSelfEmploymentCumulativeSummaryNonConsolidated"]["functionHandler"] = async (event) => {
    try {
        const { nino, businessId, taxYear, govTestScenario, fraudPreventionHeaders } = event.arguments;
        const identity = event.identity as AppSyncIdentityCognito;
        const path = buildCumulativeSummaryPath(nino, businessId, taxYear);
        const accessToken = await getStoredHmrcAccessToken(client, identity);
        const result = await getHmrcCumulativeSummary<NonConsolidatedCumulativeSummary>({
            accessToken,
            path,
            govTestScenario,
            fraudPreventionHeaders,
        }, "non-consolidated");
        return result.ok
            ? { success: true, data: result.data }
            : { success: false, error: result.error };
    } catch (error) {
        if (error instanceof HmrcCumulativeSummaryError || error instanceof HmrcTokenStoreError) {
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
                message: "Unable to retrieve the non-consolidated cumulative period summary",
            },
        };
    }
};
