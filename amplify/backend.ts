import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { changeToAccessToken } from './functions/change-to-access-token/resource';
import { getHmrcTokenStatus } from './functions/get-hmrc-token-status/resource';
import { listBusinesses } from './functions/list-businesses/resource';
import { refreshAccessToken } from './functions/refresh-access-token/resource';
import { retrieveBusinessDetails } from './functions/retrieve-business-details/resource';
import { retrieveFinalDeclarationObligations } from './functions/retrieve-final-declaration-obligations/resource';
import { retrieveIncomeAndExpenditureObligations } from './functions/retrieve-income-and-expenditure-obligations/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
defineBackend({
  auth,
  data,
  changeToAccessToken,
  getHmrcTokenStatus,
  listBusinesses,
  refreshAccessToken,
  retrieveBusinessDetails,
  retrieveFinalDeclarationObligations,
  retrieveIncomeAndExpenditureObligations,
});


// Startup url is https://d-90660e0e64.awsapps.com/start

// Using User-1 as username:
// > aws sso login  --profile amplify-dev
// > npx ampx sandbox --outputs-out-dir '/Users/jeevanjotsinghvital/Works/BulBul-SEQS front and backend/BulBul-SEQS-SwiftUI-Frontend/BulBul-SEQS/AmplifyWorks' --profile amplify-dev
