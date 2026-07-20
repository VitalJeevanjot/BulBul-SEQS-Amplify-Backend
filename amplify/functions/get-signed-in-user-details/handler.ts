import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import type { AppSyncIdentityCognito } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/get-signed-in-user-details";
import type { Schema } from "../../data/resource";
import {
    getStoredHmrcTokenStatus,
    HmrcTokenStoreError,
} from "../shared/persist-hmrc-tokens";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

export const handler: Schema["getSignedInUserDetails"]["functionHandler"] = async (event) => {
    try {
        const identity = event.identity as AppSyncIdentityCognito;

        if (!identity?.sub || !identity.username) {
            return {
                success: false,
                error: {
                    statusCode: 401,
                    code: "identity_required",
                    message: "A Cognito user identity is required",
                },
            };
        }

        const hmrcTokenStatus = await getStoredHmrcTokenStatus(client, identity);
        const email = identity.claims.email;

        return {
            success: true,
            data: {
                userId: identity.sub,
                username: identity.username,
                ...(typeof email === "string" ? { email } : {}),
                hmrcTokenStatus,
            },
        };
    } catch (error) {
        const tokenStoreError = error instanceof HmrcTokenStoreError
            ? error
            : undefined;

        return {
            success: false,
            error: {
                statusCode: tokenStoreError?.statusCode ?? 500,
                code: tokenStoreError?.code ?? "user_details_failed",
                message: tokenStoreError?.message
                    ?? "Unable to retrieve the signed-in user's details",
            },
        };
    }
};
