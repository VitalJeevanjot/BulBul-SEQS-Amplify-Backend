import type { AppSyncIdentityCognito } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/create-test-business";
import type { Schema } from "../../data/resource";
import {
    getStoredHmrcAccessToken,
    HmrcTokenStoreError,
} from "../shared/persist-hmrc-tokens";
import {
    createHmrcTestBusiness,
    HmrcTestBusinessError,
} from "../shared/hmrc-test-business";
import type { CreateTestBusinessPayload } from "../shared/hmrc-test-business.types";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

export const handler: Schema["createTestBusiness"]["functionHandler"] = async (event) => {
    try {
        const { nino, business } = event.arguments;
        const identity = event.identity as AppSyncIdentityCognito;
        const accessToken = await getStoredHmrcAccessToken(client, identity);
        const result = await createHmrcTestBusiness({
            accessToken,
            nino,
            business: business as CreateTestBusinessPayload,
        });

        return result.ok
            ? { success: true, data: result.data }
            : { success: false, error: result.error };
    } catch (error) {
        if (
            error instanceof HmrcTestBusinessError
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
                code: "CREATE_TEST_BUSINESS_REQUEST_FAILED",
                message: "Unable to create the test business",
            },
        };
    }
};
