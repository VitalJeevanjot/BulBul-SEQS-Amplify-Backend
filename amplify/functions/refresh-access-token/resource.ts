import { defineFunction, secret } from "@aws-amplify/backend";

export const refreshAccessToken = defineFunction({
    name: "refresh-access-token",
    entry: "./handler.ts",
    timeoutSeconds: 30,
    environment: {
        HMRC_CLIENT_ID: secret("HMRC_CLIENT_ID"),
        HMRC_CLIENT_SECRET: secret("HMRC_CLIENT_SECRET"),
        HMRC_TOKEN_URL: process.env.HMRC_TOKEN_URL
            ?? "https://test-api.service.hmrc.gov.uk/oauth/token",
    },
});
