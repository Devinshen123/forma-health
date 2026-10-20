# PET-02 companion backend — 2026-10-19

Owner: inspect_library / backend. Only server/ except server/index.ts and this status file are written.

## Implemented

- Read AGENTS, current PET ownership, companion plan, shared contract and backend/security skills.
- Implemented server-owned SQLite ledger, atomic settlement within Store.save/sync/saveWorkbench, cosmetics, fixed milestone chests and private two-person challenges. No companion values are accepted through health AppState.
- UTC daily and profile-local-date quest uniqueness prevent repeat rewards across the UTC/local reset overlap. Stable source identity also cannot earn the same quest again after its date is edited.
- After the actual Claude plan review, settlement observes first-seen identities only. The transaction seeds previous records as a baseline, remembers all new records including ineligible/historical ones, and awards only first-seen facts eligible on the profile-local date at that write. Claim is a ledger refresh; it never rescans old facts. Stable workout import fingerprints are additionally remembered.
- No production data/.env was read, no user services stopped or started, no dependencies installed.
- Added all six private API routes with existing route-bound account header and origin/JSON protections; strict request schemas. Unknown/foreign chests are 404, unowned gear is 409; invalid/full/expired/revoked challenges all use 404 CHALLENGE_UNAVAILABLE. Current active-challenge conflict is 409. Create/join share a persistent 20/hour owner limit, including failed guesses; leave remains unlimited.
- Invite codes have 64 bits of entropy. Self-join and member retry return the existing snapshot without adding a participant. Seven UTC calendar dates include creation date. Joining records an internal reward watermark, so pre-join rewards never contribute even at the same timestamp.
- Export includes only this account's progression, reward history, observed source identities, chests and own challenge participation. Other members' identifiers and progress are omitted. Account deletion revokes participating challenges and foreign keys cascade the account's game data.
- Added AppOptions.trustProxy (default false) at lead request. Explicit deployment configuration remains lead-owned; no forwarded headers are trusted by default.

## Validation

- `node --import tsx --test server/companion-store.test.ts`: 6 passed, 0 failed. Includes forced reward trigger failure, failed sync validation/conflict, late workbench write failure and clean retry, first-observation/backfill defenses, shared rest quota, deterministic/repeated chest and challenge/export/delete behavior. Fixtures use only synthetic temporary databases, safely removed after closing.
- `npx tsc --noEmit`: exit 0 after correcting the new workbench test fixture's required stamped field. Earlier concurrent UI/test-file incompleteness was not recorded as a passing build.
- `git diff --check -- server/app.ts server/store.ts server/companion.ts server/companion-rules.ts server/companion-router.ts server/companion-store.test.ts docs/collaboration/status/companion-backend.md`: exit 0.
- Independent QA reported `node --import tsx --test tests/companion.test.ts`: 16 passed, 0 failed, including trusted HTTPS proxy and rejected untrusted forwarded headers. Backend did not rerun that suite.
- Integrated full `npm test` and build remain lead-owned and pending at handoff. No browser or production deployment claim is made by this backend status.

## Requests / decisions

- Lead approved server-only injected companionNow for deterministic synthetic tests and local-date uniqueness. Snapshot quests.completed means claimed on this UTC day OR this current profile-local day.
- Lead approved seven UTC calendar dates including creation date and the unchanged paired challenge code contract. Only reward rows written after joining count, including with a fixed test clock.
- Root and QA received exact request/response/errors, time injection and table names. POST claim is intentionally an idempotent ledger refresh, with no retrospective eligibility sweep; all eligible new facts are settled atomically at write time.
