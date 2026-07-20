import type { AppSyncIdentityCognito } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/retrieve-business-details";
import type { Schema } from "../../data/resource";
import {
    getStoredHmrcAccessToken,
    HmrcTokenStoreError,
} from "../shared/persist-hmrc-tokens";
import {
    assertValidBusinessId,
    assertValidNino,
    HmrcBusinessDetailsError,
    parseBusinessDetailsResponse,
    requestHmrcBusinessDetails,
} from "../shared/hmrc-business-details";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

export const handler: Schema["retrieveBusinessDetails"]["functionHandler"] = async (event) => {
    try {
        const {
            nino,
            businessId,
            govTestScenario,
            fraudPreventionHeaders,
        } = event.arguments;
        const identity = event.identity as AppSyncIdentityCognito;

        assertValidNino(nino);
        assertValidBusinessId(businessId);

        const accessToken = await getStoredHmrcAccessToken(client, identity);
        const result = await requestHmrcBusinessDetails({
            accessToken,
            path: `/individuals/business/details/${encodeURIComponent(nino)}/${encodeURIComponent(businessId)}`,
            govTestScenario,
            fraudPreventionHeaders,
        }, parseBusinessDetailsResponse);

        return result.ok
            ? { success: true, data: result.data }
            : { success: false, error: result.error };
    } catch (error) {
        if (error instanceof HmrcBusinessDetailsError) {
            return {
                success: false,
                error: {
                    statusCode: error.statusCode,
                    code: error.code,
                    message: error.message,
                },
            };
        }

        if (error instanceof HmrcTokenStoreError) {
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
                code: "BUSINESS_DETAILS_REQUEST_FAILED",
                message: "Unable to retrieve business details",
            },
        };
    }
};
