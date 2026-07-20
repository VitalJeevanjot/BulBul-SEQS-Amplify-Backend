import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { changeToAccessToken } from '../functions/change-to-access-token/resource';
import { checkHmrcNino } from '../functions/check-hmrc-nino/resource';
import { getHmrcTokenStatus } from '../functions/get-hmrc-token-status/resource';
import { getSignedInUserDetails } from '../functions/get-signed-in-user-details/resource';
import { listBusinesses } from '../functions/list-businesses/resource';
import { refreshAccessToken } from '../functions/refresh-access-token/resource';
import { retrieveBusinessDetails } from '../functions/retrieve-business-details/resource';
import { customTypes } from './custom-types';

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any unauthenticated user can "create", "read", "update", 
and "delete" any "Todo" records.
=========================================================================*/
const schema = a.schema({
  ...customTypes,
  changeToAccessToken: a
    .mutation()
    .arguments({
      input: a.string().required(),
      stateId: a.string().required(),
    })
    .returns(a.ref('HmrcOAuthTokenResult').required())
    .authorization((allow) => [allow.authenticated('userPools')])
    .handler(a.handler.function(changeToAccessToken)),
  refreshAccessToken: a
    .mutation()
    .returns(a.ref('HmrcOAuthTokenResult').required())
    .authorization((allow) => [allow.authenticated('userPools')])
    .handler(a.handler.function(refreshAccessToken)),
  getHmrcTokenStatus: a
    .query()
    .returns(a.ref('HmrcTokenStatusResult').required())
    .authorization((allow) => [allow.authenticated('userPools')])
    .handler(a.handler.function(getHmrcTokenStatus)),
  checkHmrcNino: a
    .query()
    .arguments({
      nino: a.string().required(),
      govTestScenario: a.string(),
      fraudPreventionHeaders: a.string(),
    })
    .returns(a.ref('HmrcNinoCheckResult').required())
    .authorization((allow) => [allow.authenticated('userPools')])
    .handler(a.handler.function(checkHmrcNino)),
  getSignedInUserDetails: a
    .query()
    .returns(a.ref('SignedInUserDetailsResult').required())
    .authorization((allow) => [allow.authenticated('userPools')])
    .handler(a.handler.function(getSignedInUserDetails)),
  listBusinesses: a
    .query()
    .arguments({
      nino: a.string().required(),
      govTestScenario: a.string(),
      fraudPreventionHeaders: a.string(),
    })
    .returns(a.ref('ListBusinessesResult').required())
    .authorization((allow) => [allow.authenticated('userPools')])
    .handler(a.handler.function(listBusinesses)),
  retrieveBusinessDetails: a
    .query()
    .arguments({
      nino: a.string().required(),
      businessId: a.string().required(),
      govTestScenario: a.string(),
      fraudPreventionHeaders: a.string(),
    })
    .returns(a.ref('RetrieveBusinessDetailsResult').required())
    .authorization((allow) => [allow.authenticated('userPools')])
    .handler(a.handler.function(retrieveBusinessDetails)),
  UserData: a
    .model({
      username: a.string(),
      accessToken: a.string(),
      refreshToken: a.string(),
      accessTokenExpiresAt: a.datetime(),
      tokenType: a.string(),
      scope: a.string(),
    })
    .authorization((allow) => [
      allow.group('BackendTokenAccess').to(['read']),
    ]),
  HmrcOAuthAuditLog: a
    .model({
      owner: a.string().required(),
      userId: a.string().required(),
      username: a.string().required(),
      stateId: a.string(),
      eventType: a.string().required(),
      outcome: a.string().required(),
      occurredAt: a.datetime().required(),
      accessTokenFingerprint: a.string(),
      accessTokenExpiresAt: a.datetime(),
      refreshTokenFingerprint: a.string(),
      errorMessage: a.string(),
    })
    .authorization((allow) => [allow.owner().to(['read'])]),
}).authorization((allow) => [
  allow.resource(changeToAccessToken).to(['query', 'mutate']),
  allow.resource(checkHmrcNino).to(['query']),
  allow.resource(getHmrcTokenStatus).to(['query']),
  allow.resource(getSignedInUserDetails).to(['query']),
  allow.resource(listBusinesses).to(['query', 'mutate']),
  allow.resource(refreshAccessToken).to(['query', 'mutate']),
  allow.resource(retrieveBusinessDetails).to(['query', 'mutate']),
]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
