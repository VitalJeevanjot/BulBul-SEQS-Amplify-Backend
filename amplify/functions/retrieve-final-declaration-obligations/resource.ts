import { defineFunction, secret } from "@aws-amplify/backend";

export const retrieveFinalDeclarationObligations = defineFunction({
    name: "retrieve-final-declaration-obligations",
    entry: "./handler.ts",
    timeoutSeconds: 30,
    environment: {
        HMRC_CLIENT_ID: secret("HMRC_CLIENT_ID"),
        HMRC_CLIENT_SECRET: secret("HMRC_CLIENT_SECRET"),
        HMRC_API_BASE_URL: process.env.HMRC_API_BASE_URL
            ?? "https://test-api.service.hmrc.gov.uk",
        HMRC_TOKEN_URL: process.env.HMRC_TOKEN_URL
            ?? "https://test-api.service.hmrc.gov.uk/oauth/token",
    },
});
