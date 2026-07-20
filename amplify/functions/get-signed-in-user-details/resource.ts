import { defineFunction } from "@aws-amplify/backend";

export const getSignedInUserDetails = defineFunction({
    name: "get-signed-in-user-details",
    entry: "./handler.ts",
    timeoutSeconds: 30,
});
