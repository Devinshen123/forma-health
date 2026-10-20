# CHAR-02 companion character backend — 2026-10-20

Owner: character_backend / backend. This round writes only `server/companion.ts`, `server/companion-router.ts`, `server/store.ts`, the new `server/companion.test.ts`, and this status file. Read current AGENTS, TASKS, prior status and the addressed backend request; applied database-migrations and security-review skills.

## Implemented this round

- Added `PUT /api/companion/character`, strictly accepting only `{ character }` from the shared six-value enum. It inherits the existing companion router authentication, route-bound account header, JSON and origin protections; account identity comes exclusively from the authenticated session.
- Added the selected character to snapshots and account exports. New and existing accounts default to `sprout`; selecting a character returns the complete snapshot. Selection and equipment use separate upsert columns, preserving the other preference.
- Fresh databases create the profile character column with `NOT NULL DEFAULT 'sprout'` and a six-value `CHECK`. Existing two-column profile tables receive the same additive column in an immediate transaction, rechecking under the writer lock. No table rebuild, reward recalculation, historical health write or destructive production migration is used.
- Character changes are Store transactions and retain XP, active days, quest results, chests, inventory, equipment, challenge and health state/revision. Existing account foreign-key deletion cascades remove the preference; exports contain only the caller's selected character.
- Rollback strategy is to redeploy the prior code while retaining the extra column. Prior equipment writes use explicit columns and continue to work. Do not drop the column or reconstruct production profiles to roll back this cosmetic preference.

## Actual validation this round

- `node --import tsx --test server/companion.test.ts server/companion-store.test.ts`: **13 passed, 0 failed, 0 skipped**, including four new tests for all six choices/reopen/idempotence and unchanged game/health state; exact old two-column schema upgrade and repeated startup; account-specific export/delete; forced profile-write rollback. The original nine reward/challenge/transaction regressions also passed.
- The old-schema fixture is synthetic and preserves existing synthetic rewards, chests, equipment and challenge across the upgrade. It checks both pre-existing profile rows and accounts with no row, as well as rejected invalid/null database values.
- `npx tsc --noEmit`: exit 0. This is a TypeScript check, not a claim that the full asset/build pipeline ran.
- `git diff --check -- server/companion.ts server/companion-router.ts server/store.ts server/companion.test.ts`: exit 0, with only existing LF/CRLF normalization notices.
- Full `npm test`, `npm run build`, independent HTTP coverage and browser validation are explicitly coordinated by lead/QA and remain pending at this handoff. No production data or `.env` was read, no user service started/stopped, no dependencies installed, and no GitHub push performed by this role.

## Requests / decisions / limits

- Shared character union and HTTP shape were provided by lead in current TASKS; backend did not alter those contracts.
- Migration is additive and tested on synthetic prior-schema fixtures, not a copy of the user's health database. Backup and controlled local server restart belong to lead.
- No additional user decision is required for this server preference. Artwork, captions, 3D rendering and UI selection are owned by other roles.

# PET-02 companion backend — 2026-10-19 (historical)

Owner: inspect_library / backend. Only server/ except server/index.ts and this status file are written.

## Implemented

- Read AGENTS, current PET ownership, companion plan, shared contract and backend/security skills.
- Implemented server-owned SQLite ledger, atomic settlement within Store.save/sync/saveWorkbench, cosmetics, fixed milestone chests and private two-person challenges. No companion values are accepted through health AppState.
- UTC daily and profile-local-date quest uniqueness prevent repeat rewards across the UTC/local reset overlap. Stable source identity also cannot earn the same quest again after its date is edited.
- After the actual Claude plan review, settlement observes first-seen identities only. The transaction seeds previous records as a baseline, remembers all new records including ineligible/historical ones, and awards only first-seen facts eligible at that write. Meals/workouts use the profile-local date; sleep uses its own recorded time zone and current wake date, consistent with existing sleep attribution. Claim is a ledger refresh; it never rescans old facts. Stable workout import fingerprints are additionally remembered.
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

## Actual Claude final-review follow-up

- Corrected travel sleep eligibility: wake date and the current date are both calculated in sleep.timezone, and the sleep must already have ended. The reward ledger still uses UTC day and profile-local day for its two daily caps; editing a time zone or old record cannot backfill.
- Keep the latest non-revoked ended challenge as a read-only result for less than 48 hours after endsAt. The active-conflict lookup remains restricted to unexpired challenges, so creation/join can proceed after expiry. Leave also revokes the displayed ended result. No extra shared-contract fields are needed; UI checks endsAt against current time. Reward counts stop at endsAt.
- Companion GET snapshot and non-rest claim now use an explicit deferred read transaction. Other Store transactions retain BEGIN IMMEDIATE, including rest, preserving atomic writes while removing a writer reservation for simple reads.
- `node --import tsx --test server/companion-store.test.ts`: now 9 passed, 0 failed. Three new tests cover travel-zone positive/negative attribution, exact expiry/48-hour boundary/new challenge/leave/frozen points, and successful snapshot/claim under an independent WAL writer while rest correctly remains blocked.
- `npx tsc --noEmit`: exit 0. Targeted `git diff --check` also exit 0 (only Git's existing LF/CRLF normalization notices).
- Independent QA is adding and running matching HTTP travel/ended-result coverage; lead will rerun the affected suites/build and choose the necessary container scope. No service, production data or secret was touched.
