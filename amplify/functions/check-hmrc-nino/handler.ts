import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import type { AppSyncIdentityCognito } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/check-hmrc-nino";
import type { Schema } from "../../data/resource";
import { checkHmrcNinoAuthorization } from "../shared/hmrc-business-details";
import {
    getStoredHmrcAccessToken,
    HmrcTokenStoreError,
} from "../shared/persist-hmrc-tokens";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

export const handler: Schema["checkHmrcNino"]["functionHandler"] = async (event) => {
    try {
        const { nino, govTestScenario, fraudPreventionHeaders } = event.arguments;
        const identity = event.identity as AppSyncIdentityCognito;
        const accessToken = await getStoredHmrcAccessToken(client, identity);
        const result = await checkHmrcNinoAuthorization(accessToken, nino, {
            govTestScenario,
            fraudPreventionHeaders,
        });

        return result.ok
            ? { success: true, data: result.data }
            : { success: false, error: result.error };
    } catch (error) {
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
                code: "NINO_CHECK_FAILED",
                message: "Unable to validate the NINO with HMRC",
            },
        };
    }
};
