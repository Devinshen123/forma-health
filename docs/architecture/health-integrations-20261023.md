# Forma health integrations · 2026-10-23

User approved the staged integration Prompt, then explicitly requested WHOOP/Oura authorization callbacks and backend sync, plus Google Health and Apple Health, followed by guided official registration. Work continues in the existing clean Fud checkout on codex/fud-food-photo-20261022; original C checkout and other workers remain untouched. One lead writer.

## Delivery and boundaries

WHOOP, Oura and Google Health use server-side authorization-code OAuth with single-use expiring state, account/session binding, encrypted credentials, fixed official endpoints, minimal read scopes, refresh and bounded paginated polling. Redirect callbacks live outside generic API CSRF guards, protected by their own OAuth binding. Existing strict session cookies remain strict: use a short-lived SameSite=Lax callback binding cookie and verify the original live session server-side; no global cookie weakening. Refuse account switching on callback, including when the strict session cookie is omitted by cross-site browser navigation. Tokens and codes never enter frontend payloads or logs. Consent denial and missing configuration are truthful states.

Imported records use src/health.ts, separate SQLite tables with account cascade deletion and export, stable source IDs, account/provider namespaces, replay-safe updates, bounded payload validation, per-connection sync exclusion, stale-result rejection after disconnect/delete and atomic complete-page persistence. Preserve unknown values as null. Do not sum overlapping steps/energy/sleep from different sources, overwrite manual facts, or send wearable records to AI. Show provider records for review with explicit source and units. Disconnect stops sync; deleting imported records is a separate explicit action.

First polling window is bounded recent history with overlap to pick up updates; advance successful sync time only on complete success. Do not claim arbitrary historical backfill or guaranteed realtime. Provider deletion limitations must be stated when not supported; never infer deletions from an incomplete page/window. Registration credentials and approved HTTPS callback URL are required before live cloud sync. Google Health API is distinct from Android Health Connect; official REST reference verified this turn uses v4/v4beta, with Google Health identity verification after OAuth and googlehealth readonly scopes (not Google Fit endpoints).

Apple Health uses the existing iPhone SwiftUI app, read-only HealthKit permission followed by a separate explicit upload confirmation to the signed-in Forma backend. Apple Watch data arrives through Apple Health. Query original source/device metadata, keep source UUIDs and HealthKit deletions where supported. Missing read data is not zero and cannot prove permission denial. Scope uploads/anchors to account and server, acknowledge before advancing, reject account/session changes. Web shows the native requirement, not a pretend web OAuth button. Windows cannot build or device-test Xcode: record this limitation and provide Mac validation steps.

## HTTP contracts

- GET /api/health/connections -> HealthConnectionsResponse (account header required).
- POST /api/health/:provider/connect with {} -> {authorizationUrl:string}; cloud only.
- GET /integrations/:provider/callback -> safe result page/redirect, never tokens.
- POST /api/health/:provider/sync with {} -> HealthSyncResponse; cloud only.
- POST /api/health/:provider/disconnect with {} -> connection status, retains imported history.
- DELETE /api/health/:provider/records with {confirm:true} -> {deleted:number}.
- GET /api/health/records?provider=...&limit=...&cursor=... -> HealthRecordsResponse.
- POST /api/health/apple-health/import with AppleHealthImport -> HealthSyncResponse. Include expectedRevision from the Apple connection read before preview; disconnect/delete increments syncRevision and invalidates old previews/batches with 409. Successful batches preserve this revision so lost acknowledgements can safely replay stable IDs.

Use existing session-derived identity plus X-Forma-Account and trusted-origin protection on private routes. No user IDs accepted in bodies. Current capabilities root shape remains compatible. New UI loads health endpoints separately.

## Validation

Synthetic mock-provider HTTP tests cover state replay/expiry/session binding, malformed and oversized responses, partial scopes, encrypted token storage, refresh rotation, failure atomicity, pagination/replay, account isolation, disconnect races, exports/deletion and Apple import validation. Root runs the full suite and build and verifies deployed UI with isolated fixture data. Actual provider approval, real wearable accounts and HealthKit on-device tests remain separate from mock proof.

## Official sources

- https://developer.whoop.com/docs/developing/oauth/
- https://developer.whoop.com/api/
- https://developer.whoop.com/docs/developing/app-approval/
- https://cloud.ouraring.com/v2/docs
- https://developer.ouraring.com/
- https://developers.google.com/health/get-started
- https://developers.google.com/health/developer-checklist
- https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data

Implementation choices above are lead decisions within the approved scope. No credentials, health accounts, paid resources or application submissions are created by this design document.
