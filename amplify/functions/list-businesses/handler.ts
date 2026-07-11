import type { AppSyncIdentityCognito, AppSyncResolverHandler } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/list-businesses";
import type { Schema } from "../../data/resource";
import { getStoredHmrcAccessToken } from "../shared/persist-hmrc-tokens";
import {
    assertValidNino,
    requestHmrcBusinessDetails,
} from "../shared/hmrc-business-details";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

type ListBusinessesArguments = {
    nino: string;
    govTestScenario?: string | null;
    fraudPreventionHeaders?: string | null;
};

export const handler: AppSyncResolverHandler<
    ListBusinessesArguments,
    string
> = async (event) => {
    const { nino, govTestScenario, fraudPreventionHeaders } = event.arguments;
    const identity = event.identity as AppSyncIdentityCognito;

    assertValidNino(nino);

    const accessToken = await getStoredHmrcAccessToken(client, identity);

    return requestHmrcBusinessDetails({
        accessToken,
        path: `/individuals/business/details/${encodeURIComponent(nino)}/list`,
        govTestScenario,
        fraudPreventionHeaders,
    });
};
