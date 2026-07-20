import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import type { AppSyncIdentityCognito } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/get-hmrc-token-status";
import type { Schema } from "../../data/resource";
import {
    getStoredHmrcTokenStatus,
    HmrcTokenStoreError,
} from "../shared/persist-hmrc-tokens";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

export const handler: Schema["getHmrcTokenStatus"]["functionHandler"] = async (event) => {
    try {
        const identity = event.identity as AppSyncIdentityCognito;
        const data = await getStoredHmrcTokenStatus(client, identity);

        return { success: true, data };
    } catch (error) {
        const tokenStoreError = error instanceof HmrcTokenStoreError
            ? error
            : undefined;

        return {
            success: false,
            error: {
                statusCode: tokenStoreError?.statusCode ?? 500,
                code: tokenStoreError?.code ?? "token_storage_failed",
                message: tokenStoreError?.message
                    ?? "Unable to check the user's HMRC token status",
            },
        };
    }
};
