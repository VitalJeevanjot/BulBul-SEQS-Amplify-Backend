import { defineFunction } from "@aws-amplify/backend";

export const retrieveBusinessDetails = defineFunction({
    name: "retrieve-business-details",
    entry: "./handler.ts",
    timeoutSeconds: 30,
    environment: {
        HMRC_API_BASE_URL: process.env.HMRC_API_BASE_URL
            ?? "https://test-api.service.hmrc.gov.uk",
    },
});
