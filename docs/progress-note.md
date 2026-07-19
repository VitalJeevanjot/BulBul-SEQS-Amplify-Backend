# Progress Note

Created on 2026-07-19 for branch `snapshot/hmrc-business-details-progress`.

## Completed So Far

- Added Amplify Gen 2 backend support for HMRC OAuth token exchange and refresh.
- Persisted HMRC access and refresh tokens in the `UserData` model for authenticated users.
- Added HMRC OAuth audit logging for authorization-code exchange and refresh-token exchange outcomes.
- Added HMRC Business Details API Lambda queries:
  - `listBusinesses`
  - `retrieveBusinessDetails`
- Wired both Business Details Lambdas into the Amplify backend and GraphQL schema.
- Implemented shared HMRC Business Details request handling with:
  - stored HMRC access token lookup
  - HMRC API v2 `Accept` header
  - NINO validation
  - business ID validation
  - optional sandbox `Gov-Test-Scenario`
  - optional JSON-encoded fraud prevention headers
- Updated `AGENTS.md` so Amplify frontend outputs are generated under the `Works` frontend path.
- Ran `npx ampx sandbox --outputs-out-dir '/Users/jeevanjotsinghvital/Works/BulBul-SEQS front and backend/BulBul-SEQS-SwiftUI-Frontend/BulBul-SEQS/AmplifyWorks' --profile amplify-dev`.
- Confirmed `amplify_outputs.json` was written successfully and stopped the local sandbox watcher without deleting deployed AWS sandbox resources.
- Verified TypeScript with `npx tsc -p amplify/tsconfig.json --noEmit`.

## Current Baseline

The branch was created from commit `9028dee` (`Add HMRC business details functions`) on `main`.
