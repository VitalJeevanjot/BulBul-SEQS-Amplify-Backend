import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { changeToAccessToken } from './functions/change-to-access-token/resource';
import { refreshAccessToken } from './functions/refresh-access-token/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
defineBackend({
  auth,
  data,
  changeToAccessToken,
  refreshAccessToken,
});


// Startup url is https://d-90660e0e64.awsapps.com/start

// Using User-1 as username:
// > aws sso login  --profile amplify-dev
// > npx ampx sandbox --outputs-out-dir '/Users/jeevanjotsinghvital/Desktop/BulBul-SEQS front and backend/BulBul-SEQS-SwiftUI-Frontend/BulBul-SEQS/AmplifyWorks' --profile amplify-dev
