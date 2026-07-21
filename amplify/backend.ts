import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { changeToAccessToken } from './functions/change-to-access-token/resource';
import { createTestBusiness } from './functions/create-test-business/resource';
import { getHmrcTokenStatus } from './functions/get-hmrc-token-status/resource';
import { getSelfEmploymentCumulativeSummaryConsolidated } from './functions/get-self-employment-cumulative-summary-consolidated/resource';
import { getSelfEmploymentCumulativeSummaryNonConsolidated } from './functions/get-self-employment-cumulative-summary-non-consolidated/resource';
import { listBusinesses } from './functions/list-businesses/resource';
import { putSelfEmploymentCumulativeSummaryConsolidated } from './functions/put-self-employment-cumulative-summary-consolidated/resource';
import { putSelfEmploymentCumulativeSummaryNonConsolidated } from './functions/put-self-employment-cumulative-summary-non-consolidated/resource';
import { refreshAccessToken } from './functions/refresh-access-token/resource';
import { retrieveBusinessDetails } from './functions/retrieve-business-details/resource';
import { retrieveFinalDeclarationObligations } from './functions/retrieve-final-declaration-obligations/resource';
import { retrieveIncomeAndExpenditureObligations } from './functions/retrieve-income-and-expenditure-obligations/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  changeToAccessToken,
  createTestBusiness,
  getHmrcTokenStatus,
  getSelfEmploymentCumulativeSummaryConsolidated,
  getSelfEmploymentCumulativeSummaryNonConsolidated,
  listBusinesses,
  putSelfEmploymentCumulativeSummaryConsolidated,
  putSelfEmploymentCumulativeSummaryNonConsolidated,
  refreshAccessToken,
  retrieveBusinessDetails,
  retrieveFinalDeclarationObligations,
  retrieveIncomeAndExpenditureObligations,
});

// Required MFA cannot be combined with passwordless first-factor methods.
// Explicitly restrict Cognito to password sign-in so an existing pool with
// WebAuthn enabled can transition safely to required TOTP MFA.
backend.auth.resources.cfnResources.cfnUserPool.addPropertyOverride(
  'Policies.SignInPolicy.AllowedFirstAuthFactors',
  ['PASSWORD'],
);


// Startup url is https://d-90660e0e64.awsapps.com/start

// Using User-1 as username:
// > aws sso login  --profile amplify-dev
// > npx ampx sandbox --outputs-out-dir '/Users/jeevanjotsinghvital/Works/BulBul-SEQS front and backend/BulBul-SEQS-SwiftUI-Frontend/BulBul-SEQS/AmplifyWorks' --profile amplify-dev
