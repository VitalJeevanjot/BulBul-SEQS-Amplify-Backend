import type { AppSyncIdentityCognito } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/retrieve-income-and-expenditure-obligations";
import type { Schema } from "../../data/resource";
import {
    buildIncomeAndExpenditureObligationsPath,
    HmrcObligationsError,
    parseIncomeAndExpenditureObligationsResponse,
    requestHmrcObligations,
} from "../shared/hmrc-obligations";
import {
    getStoredHmrcAccessToken,
    HmrcTokenStoreError,
} from "../shared/persist-hmrc-tokens";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

export const handler: Schema["retrieveIncomeAndExpenditureObligations"]["functionHandler"] = async (event) => {
    try {
        const {
            nino,
            typeOfBusiness,
            businessId,
            fromDate,
            toDate,
            status,
            govTestScenario,
            fraudPreventionHeaders,
        } = event.arguments;
        const identity = event.identity as AppSyncIdentityCognito;
        const path = buildIncomeAndExpenditureObligationsPath(nino, {
            typeOfBusiness,
            businessId,
            fromDate,
            toDate,
            status,
        });
        const accessToken = await getStoredHmrcAccessToken(client, identity);
        const result = await requestHmrcObligations({
            accessToken,
            path,
            govTestScenario,
            fraudPreventionHeaders,
        }, parseIncomeAndExpenditureObligationsResponse);

        return result.ok
            ? { success: true, data: result.data }
            : { success: false, error: result.error };
    } catch (error) {
        if (
            error instanceof HmrcObligationsError
            || error instanceof HmrcTokenStoreError
        ) {
            return {
                success: false,
                error: {
                    statusCode: error.statusCode,
                    code: error.code,
                    message: error.message,
                },
            };
        }

        return {
            success: false,
            error: {
                statusCode: 500,
                code: "OBLIGATIONS_REQUEST_FAILED",
                message: "Unable to retrieve income and expenditure obligations",
            },
        };
    }
};
