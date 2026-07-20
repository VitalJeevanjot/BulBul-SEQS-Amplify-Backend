import { defineFunction } from "@aws-amplify/backend";

export const getHmrcTokenStatus = defineFunction({
    name: "get-hmrc-token-status",
    entry: "./handler.ts",
    timeoutSeconds: 30,
});
