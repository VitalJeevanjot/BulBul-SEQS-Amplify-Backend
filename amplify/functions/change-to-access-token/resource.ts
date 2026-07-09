import { defineFunction, secret } from "@aws-amplify/backend";

export const changeToAccessToken = defineFunction({
    name: 'change-to-access-token',
    entry: './handler.ts',
    timeoutSeconds: 30,
    environment: {
        HMRC_CLIENT_ID: secret('HMRC_CLIENT_ID'),
        HMRC_CLIENT_SECRET: secret('HMRC_CLIENT_SECRET'),
        HMRC_REDIRECT_URI: process.env.HMRC_REDIRECT_URI ?? 'com.jsv.bulbulseqs://hmrc-auth-callback',
        HMRC_TOKEN_URL: process.env.HMRC_TOKEN_URL
            ?? "https://test-api.service.hmrc.gov.uk/oauth/token",
    },
})
