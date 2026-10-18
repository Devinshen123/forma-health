# FORMA B-18 / Codex then Claude Code / 2026-10-18

Branch: codex/forma-put-cleanup-retry-20261018
Worktree: C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-review-recovery
Integrated baseline: 85912f2d85f5758e88686950c870990a8acf008a
Codex owner: /root/forma_backend_20261018
Claude reviewer session (prepared, acceptance requires actual CLI receipt): 7bd94c31-1d67-4b13-85e4-b196ac699a2d
Evidence, temporary SQLite/uploads, browser profiles and caches: D:\CodexTaskData\forma-codex-claude-20261018\backend

## Current authorization and ownership

This new task supersedes prior Claude-only/read-only phase limitations. Codex diagnoses/implements first. After its files and diff are handed off, real Claude Code cross-reviews this same direction and may add bounded supplements only with coordinator handoff. Never two writers on the same file. Previous dated records remain historical evidence, not new task results.

Read AGENTS.md, CLAUDE.md, docs/PROJECT-STATUS.md, docs/SKILLS-HANDOFF.md and this task first. Preserve all user changes and four deletions, including src/catalog/exercises.json; never restore/fake data or type declarations. AGENTS original bytes were preserved before appending this entry; do not stage user content. No push, remote branches, PR, merge, deploy, installs, account/permissions changes, credentials, purchases, real health data, Apple/HealthKit or paid AI. Do not touch the integrated site's service or Showroom/Mail browser tabs and services.

Product/test writable paths: server/store.ts, server/app.ts, server/state-cleanup-retry.test.ts. Own status: docs/collaboration/status/backend-20261018.md. Own report: docs/reviews/20261018-backend.md. Other product files require a concrete report to coordinator first. Root owns task/entry/global status files and exact-path commits.

## Task

Reproduce PUT /api/state post-commit attachment cleanup failure and implement bounded durable retry using the existing owner/mutation/asset intent table. Internal put-state:<inputRevision> keys cannot collide with UUID sync mutation IDs. Persist exact previous-to-next removal intent in Store.save transaction; a fully parsed authenticated stale retry may consume the already-persisted exact intent while preserving the existing 409 conflict status and current-state reference recheck. Never derive candidates from the retry payload, scan all uploads, or infer legacy hash-only receipt history. No DDL needed. Report crash-atomicity findings from independent review before expanding scope.

## Acceptance

Real synthetic HTTP/SQLite red-before-green: delete failure commits state once; restart+same stale PUT returns409 but exact old attachment becomes404; intent-write ABORT rolls state/revision back; owner/current-reference/unsaved candidates stay safe; idempotent retries. Focused suite then complete npm test equivalent once. No production data/migrations.

All heavy tests/builds/browser runs require coordinator's single FORMA test slot. Use existing installed dependencies through the test-only runtime hook at D:\CodexTaskData\forma-codex-claude-20261018\runtime-hook.mjs; do not mutate shared node_modules. Set TEMP/TMP, FORMA_TEST_OUTPUT and any cache/profile to your D evidence directory. Ports must be random loopback; browser headless/system Edge with GPU disabled. Do not start npm dev/start fixed services or stop other processes. C has only about3.09GiB free; D about236.53GiB.

## Skills: actually read before use

- Codex: C:\Users\devin\.codex\skills\backend-patterns\SKILL.md; Claude: C:\Users\devin\.claude\skills\backend-patterns\SKILL.md
- Codex: C:\Users\devin\.codex\skills\security-review\SKILL.md; Claude: C:\Users\devin\.claude\skills\security-review\SKILL.md
- Codex: C:\Users\devin\.codex\skills\database-migrations\SKILL.md; Claude: C:\Users\devin\.claude\skills\database-migrations\SKILL.md

Use security-review for owner/account/private-upload boundaries; backend-patterns for Express/SQLite/CAS/receipts; database-migrations only to assess existing durable intent compatibility/transactions, not as permission for production schema changes; playwright for real DOM/browser lifecycle tests using the existing .mts harness. No redesign skill is needed. Skills are actual absolute files, not proof of slash-command registration. If missing/unreadable report it, do not install/copy private plugins. Adapt SQL examples to SQLite parameter binding, not Postgres/Supabase. Read exact tool scripts before running any recommended scripts. No need to copy an unverified TDD package: demonstrate real red-before-green where fixing a defect.

## Delivery

Record exact source SHA/diff, commands, exit codes, counts, evidence paths and limitations. Old215/18/build results are historical integrated-baseline evidence only until actually rerun. JSON export includes records and attachment metadata/references, not image/PDF bytes; server export also omits unsynced client outbox. Never call JSON alone a full backup. iPhone/Safari, real AI, full App shell are unverified unless actually tested.