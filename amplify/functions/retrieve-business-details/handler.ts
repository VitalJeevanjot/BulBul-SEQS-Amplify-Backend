import type { AppSyncIdentityCognito, AppSyncResolverHandler } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/retrieve-business-details";
import type { Schema } from "../../data/resource";
import { getStoredHmrcAccessToken } from "../shared/persist-hmrc-tokens";
import {
    assertValidBusinessId,
    assertValidNino,
    requestHmrcBusinessDetails,
} from "../shared/hmrc-business-details";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

type RetrieveBusinessDetailsArguments = {
    nino: string;
    businessId: string;
    govTestScenario?: string | null;
    fraudPreventionHeaders?: string | null;
};

export const handler: AppSyncResolverHandler<
    RetrieveBusinessDetailsArguments,
    string
> = async (event) => {
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

    return requestHmrcBusinessDetails({
        accessToken,
        path: `/individuals/business/details/${encodeURIComponent(nino)}/${encodeURIComponent(businessId)}`,
        govTestScenario,
        fraudPreventionHeaders,
    });
};
