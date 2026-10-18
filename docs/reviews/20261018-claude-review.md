HANDOFF PROVENANCE: Real official Claude Code CLI, session eb252693-373a-4e70-a821-4b8e1aca635d. Initial reviewed HEAD 67dff9c8a78a76e22fd9290e10c95e0a17130dec. The completed reports below are copied verbatim from CLI result fields. Original review calls were read-only; test execution actors are identified separately.

# FORMA Q-18: Claude Code cross-review (read-only)

**Reviewer:** real Claude Code session `eb252693-373a-4e70-a821-4b8e1aca635d`, model `claude-opus-5-5`. Date 2026-10-17 local / 2026-10-18 UTC per evidence timestamps.

**What I did:** I read the code and evidence, and ran only read-only `git` commands (`show`, `diff`, `log`, `status`) and file hashing. I ran no tests, builds, browsers or services. I made no edits or commits. I did not read credentials or session-history streams. All execution counts below come from **Codex runs** whose logs and metadata I checked. None of them are my own runs.

**Skills:** I read the Claude `security-review`, `backend-patterns` and `database-migrations` SKILL.md files during preflight in this same session, plus `playwright` for context only. I used them as checklists, adapted to Express and SQLite. I don't claim they are registered as slash commands.

## 1. Exact reviewed SHAs

| Direction | Worktree / branch | HEAD | Diff reviewed |
|---|---|---|---|
| Q | `forma-health` / `codex/forma-recovery-audit-20261018` | `67dff9c8a78a76e22fd9290e10c95e0a17130dec` | `85912f2..67dff9c` (7 files, +343); also `5d003c2..67dff9c` for the tests |
| B | `forma-review-recovery` / `codex/forma-put-cleanup-retry-20261018` | `6739b927eb5c760d8232df970998a11401240d26` | `85912f2..6739b92` (`server/app.ts`, `server/store.ts`, `server/state-cleanup-retry.test.ts`, docs) |
| F | `forma-record-flows` / `codex/forma-frontend-boundaries-20261018` | `14eb6da5640e0561df8e850953c346e04d310a7e` | `git diff 85912f2..14eb6da` only. I did not read the live worktree script or the Claude F supplement. |

- **Product changes:** Q and F have no product (`server/`, `src/`) changes; they change only tests and docs. B's `server/` is identical between `6ea52c0` and `6739b92`, which adds only two MDs.
- **Worktree state:** all three worktrees show the same unstaged user state: modified `AGENTS.md` plus four deletions, including `src/catalog/exercises.json`. Nothing was restored.
- **Buildability:** the tracked baseline catalog blob does not make these dirty worktrees buildable. No build has been verified here.

## 2. Findings, in priority order

### F-1. Introduced defect (B `6ea52c0`, Medium): the missing-bytes guard rejects all references, not just new ones, which can lock out an account's writes

**Status:** established by code reading. I did not reproduce it at runtime because no slot was granted.

**Where:**
- `server/app.ts:305-308` @6739b92. `validateOwnedState` checks `store.assetBytesAvailable(asset)` for every asset in `referencedAssets(state)`. That is the full candidate state, not the references the request adds.
- Both write routes go through it:
  - sync at `app.ts:324`
  - PUT through `Store.save` at `store.ts:128`

**Consequence:** suppose a stored record already references an asset whose metadata row exists but whose bytes are gone. Then every later save that keeps that record returns 400 "An attachment is unavailable or invalid for this account". That includes unrelated meal, sleep or training saves.

**Client impact (static reading of `src/sync/engine.ts` @6739b92):**
- A 400 keeps the mutation at the head of the queue (lines 91-106: "never acknowledged or silently discarded").
- With offline storage off, `save()` then refuses further saves while the queue is non-empty (line 61).
- The user sees the generic message at `src/api.ts:49` ("check dates, values…"), which does not identify the broken attachment.
- The only way out is to delete the specific broken record, and the user has no way to know which one it is.

**Reachability:**
- Records accepted on the baseline code. Q's own red evidence shows exactly this: `referenceStatus: 200` and `currentReportReferencesMissingAsset: true`.
- A database restored without `uploads/`. This is a realistic risk because JSON export carries no bytes.
- Out-of-band file loss.

**Mismatch with the reports:** the Q and B reports both describe the guard as preventing "new references". The implementation is broader than that, and B's tests only cover new references.

**Requested change (B owner, later serial handoff):**
- Byte-check only asset IDs that are newly referenced, i.e. in `referencedAssets(next)` but not in `referencedAssets(previous)`. Both are already in scope.
- Or get an explicit product decision that a full lockout is intended.
- Add a red-then-green HTTP test: an existing report references metadata-present/bytes-missing asset X, and an unrelated upsert (for example a sleep record) must still succeed via both sync and PUT, while a new reference to X is still rejected.

### F-2. Pre-existing, known and unresolved (Medium, confirmed red): a crash before cleanup COMMIT restores metadata after the bytes are already deleted

- **Where:** `server/store.ts:314-323` @6739b92 (lines 295-305 at baseline). `deleteUnreferencedAsset` runs `DELETE FROM assets` and then `rmSync` inside the `completeAssetCleanup` transaction, before COMMIT.
- **Evidence:** Q's `codex-baseline-r2/cleanup-crash-observation.json`:
  - child exit 73, `signal: null`
  - `metadataRestored: true`, `bytesPresent: false`, intent restored
  - GET 500 before and after the new reference
  - reference POST 200; replay 200 consumes the intent while the report keeps referencing missing bytes
  - candidate and other-owner reads 200; cross-owner read 404
- **Clarification of scope:** the bytes that are lost belong to an asset the committed state had already stopped referencing. `deleteUnreferencedAsset` rechecks references under the write lock, so this window cannot remove bytes for a currently referenced record.
- **Actual harm:**
  - Metadata comes back for a file that no longer exists: GET returns 500, and `/api/export` lists phantom attachment metadata.
  - On the baseline, a new reference to that attachment was accepted.
  - If the same receipt is replayed, the restored intent retires the row. If it is never replayed, the phantom stays indefinitely.
- **After B's guard:** new references are rejected (B's tests, plus Q's narrow 3/3 run). That is a different claim from fixing the rollback. The rollback still happens and the original bytes still cannot be restored. Q's invariant assertion at `tests/cleanup-recovery-boundaries.test.ts:149` would still fail on B's code; nobody has rerun it there.
- **Fix direction:** out of scope here and not implemented. For example, commit the row deletion and a tombstone first, then remove the file.

### F-3. Pre-existing known limit: old hash-only receipts

- A replay with no intent rows returns 200 with the unchanged snapshot. A changed payload returns 409. No intent is created, and no unsaved candidate or other-owner asset is scanned or deleted.
- The cost is that cleanup history which was never recorded cannot be recovered. Orphan bytes from those removals are kept indefinitely.
- **Fixture fidelity:** the `67dff9c` fixture does a real `Store.sync` deletion, then deletes only that one owner/mutation intent row (lines 88-89). This is equivalent to a database written before the intent table existed: `CREATE TABLE IF NOT EXISTS` creates the table empty.
- **What the fixture does not model:**
  - database files written by older schema versions
  - an old receipt whose immediate cleanup half-ran
  - receipts from much older code paths

### F-4. Pre-existing, Low: a missing file returns 500 instead of a controlled status

`app.ts:388` calls `readFileSync` and the resulting ENOENT becomes a generic 500. A 404 or 410 would make phantom metadata diagnosable. No health content leaks, because the message is generic.

### F-5. Introduced by B, informational, not a defect

- **Stale PUT now has a side effect.** On a stale revision, PUT runs `finishMutationCleanup(put-state:<revision>)` before returning 409 (`app.ts:344`). This is gated by:
  - authentication and the account header
  - a full `putStateSchema` parse
  - an existing owner-scoped intent row
  - a current-reference recheck under the write lock

  A client-chosen past revision can only resume that owner's own recorded intents. `put-state:N` cannot collide with sync IDs, because `idSchema = z.string().uuid()` (`server/validation-primitives.ts:3`).
- **Filesystem errors other than ENOENT/ENOTDIR.** `assetBytesAvailable` rethrows them (`store.ts:303-309`). The transaction rolls back and the request returns 500, not 400. That does fail closed. "Fails closed" in the reports means 500, and the check does not verify the file is readable or the right size, which B already discloses.

### F-6. Q test and evidence provenance (Low; supplements requested)

- **No test-file hash for the 2-pass/1-fail run.** `codex-baseline-r2` ran a pre-commit, untracked test file, and its metadata records no hash for it. `git diff 5d003c2..67dff9c` shows that only the legacy test body changed: from `Store.save` plus a hand-inserted receipt, to a real sync plus deleting the intent row. The sync and crash bodies are identical, and the failing line 149 still matches. So the 2-pass/1-fail applies to `5d003c2`-equivalent content.
- **`67dff9c` has never been run as one complete file.** The portable rerun ran the legacy case alone. Its hash `3BC08950…` matches the committed blob, which I verified.
- **Missing assertion:** before spawning the child, assert that the removed asset's bytes exist. This proves the child's `rmSync` caused their absence rather than inferring it from `addAsset`.
- **Requested supplemental run (one serial slot, later):** the Q test file on top of B `6739b92`. Expected result:
  - legacy and sync controls pass
  - the crash test still fails at line 149
  - the observation records `referenceStatus: 400`

  The conditional assertion at lines 150-151 is unreachable while line 149 fails. That is acceptable, but it should be stated.

### F-7. F `14eb6da`: no blocking issue in the original component evidence

- The diff adds owner-remount cases for editor, delete, delayed upload and offline queue, plus `posts.length === 0` on stale-confirmation cases.
- The assertions are substantive:
  - A's snapshot compared by deep equality through a separate login (fixing the earlier invalidated-cookie mistake)
  - exactly one write after reopening as B, carrying B's header
  - PDF bytes compared, cross-owner reads 404
  - B's retry cannot drain A's IndexedDB queue
  - A's exact mutation ID replayed
- **Minor note:** the immediate `writes.length === 0` check after remount could miss a late stale write. The later `writes.length === 1` check would still catch it, so this is acceptable.
- **Orphan upload:** the delayed-upload case deliberately leaves A's upload behind, because cleanup gets 401 under B's cookie. That is conservative retention, not GC.

## 3. Fixture and failpoint verification

- **Session cookie correction is valid.**
  - Baseline `app.ts:206` accepts only `/^[a-f0-9]{64}$/`.
  - The first run used a UUID. All of its HTTP observations returned 401: `codex-baseline/tests.log` shows 1 pass / 2 fail (`401 !== 200`), and the observation JSON shows 401 throughout.
  - The fixed fixture uses `randomBytes(32).toString('hex')` (test line 31).
  - The first run is correctly kept as harness error, not product red. In it, the metadata-restored and bytes-missing filesystem facts already reproduced, independent of HTTP.
- **The failpoint is at the right place.**
  - `tests/fixtures/cleanup-crash-child.mts:12-19` overrides `db.exec` after the Store is constructed, so the schema-setup COMMIT is not intercepted.
  - The child writes an attestation line and calls `process.exit(73)` on the first `COMMIT`.
  - In cleanup mode the only transaction is `completeAssetCleanup`: BEGIN IMMEDIATE, intent check, row DELETE, `rmSync`, intent DELETE, then COMMIT. So the exit happens after `rmSync` and before COMMIT.
  - The parent asserts `status === 73`, `signal === null` and the mode attestation (test lines 73-76). Line 26 throws if the failpoint is never reached.
  - The sync control shows state, versions, receipt and intent rolled back together, with bytes intact (`sync-crash-control.json`).
- **Simulation limit:** this is a process exit inside Node, where the open SQLite transaction is rolled back. It is **not** a physical power loss, OS crash, disk fault or fsync-ordering test, and the reports correctly say so.
- **The 2-pass/1-fail is classified correctly.** The two controls are genuine passes. The one failure is the intended crash-boundary product red: not skipped, not marked TODO, not inverted.

## 4. Evidence counts I checked (all Codex executions)

| Run | Owner | Command (from metadata) | Result |
|---|---|---|---|
| `review/codex-baseline` | Q Codex | `node --import tsx --test --test-concurrency=1 tests/cleanup-recovery-boundaries.test.ts` | exit 1; 3 tests, 1 pass / 2 fail. Harness 401 error, not product evidence. |
| `review/codex-baseline-r2` | Q Codex | same, at HEAD `911ffe3` plus untracked tests | exit 1; 3 tests, 2 pass / 1 fail (line 149); 0 skip/cancel/todo; 910.95 ms |
| `review/independent-backend-guard` | Q Codex, in the B worktree | `--test-name-pattern 'missing private bytes\|attachment validation under the save lock' server/state-cleanup-retry.test.ts` | exit 0; 3/3. Head `6ea52c0` before and after. File hashes match `6ea52c0`/`6739b92` blobs after CRLF normalization, which I verified. |
| `review/legacy-portable-fixture` | Q Codex | `--test-name-pattern 'legacy hash-only receipt'` | exit 0; 1/1. Test hash before and after = committed `67dff9c` blob. |
| `backend/red-missing-bytes-guard` | B Codex | narrow red run | 3 tests, 0 pass / 3 fail (`200 !== 400` ×3), on head `d824f31` plus a dirty guard |
| `backend/focused-put-sync-guard` | B Codex | focused run | 20/20 |
| `backend/full-suite-guard` | B Codex | `server/*.test.ts server/rules/*.test.ts tests/*.test.ts` | exit 0; 223/223, 0 fail/skip/cancel/todo. Source hashes = `6ea52c0` product. Q's test file is not in the B worktree, so it is not part of the 223. |
| `frontend/focused-r2` | F Codex | `node --import tsx tests/browser/sleep-report-lifecycle.mts` with filter | exit 0; `results.json` 8/8 `passed:true`, `pageErrors: []` |
| `frontend/full-24` | F Codex | same, no filter | exit 0; 24/24 `passed:true`, `pageErrors: []`. Script SHA256 `42D8560E…` = the `14eb6da` blob with CRLF, which I verified. Head recorded honestly as `a266346` plus the dirty script. |

The old integrated 215 tests / 18 browser cases / build results are historical. Nothing in this table reran them, and nobody has run the combined F+B+Q code.

## 5. Acceptance status

- **Q `67dff9c`: accepted.** The tests, fixture, raw evidence and report are accurate. The cookie correction is valid, the failpoint is exact, and the retained 2-pass/1-fail is classified correctly. Supplements requested under F-6. One wording correction is requested: the report should say the B guard checks *every* reference (F-1).
- **B `6739b92`:**
  - The PUT durable-intent retry (`d824f31`) is accepted. I found no defect in it.
  - The missing-bytes guard (`6ea52c0`) is **changes requested** because of introduced finding F-1. That needs either a newly-referenced-only check plus a regression test, or a recorded product decision.
  - Nothing in B fixes the F-2 rollback, and B does not claim it does.
- **F `14eb6da`: the original component evidence is accepted.** This says nothing about the later Claude F supplement, which I did not review.
- **Overall:** one newly introduced defect is established (F-1). No other introduced defect was established in the reviewed diffs, which does not mean the code is unconditionally safe. The crash rollback (F-2) is still a known, unresolved red case.

## 6. Limitations

- I ran no tests, so every count above is Codex's execution. F-1 has not been run as a test.
- No physical power-loss, OS, disk or fsync test was run by anyone. The Q crash case is a deterministic child-process exit at the application level.
- **JSON export:** it contains records and attachment metadata/references, **not image or PDF bytes**. Server export also excludes the client's unsynced outbox. JSON alone is not a full backup, and after F-2 it can list phantom attachment metadata.
- **Not verified:** the full App shell and account-key wiring, browser restart persistence, iPhone/Safari, real AI providers, the combined F+B+Q code, and buildability of these dirty worktrees with `exercises.json` deleted.
- I did not inspect or operate the integrated running site or the Showroom/Mail tabs or services.

## Coordinator post-review evidence and finding resolution

The unchanged complete Q test file at67dff9c was subsequently run once with TAP output and immutable source/fixture snapshots/hashes in review/final-audit-3: exit1,2pass/1known physical-cleanup failure,0skip/todo/cancel. This closes the complete-file provenance gap without changing or hiding the red case. This run targets the Q branch baseline product, not B's later guard, and is a coordinator execution. No physical power loss was simulated.

The Q review's F-1 applies to B6739b92. It was later corrected in B13402e1, with Codex red2/green2/focused22/full225 and independent Q final2/2 at review/independent-review-f1. The same real Claude B reviewer assessed the final correction in backend/followup-receipt.json. The original Q report above remains an accurate review of its stated old B target; it must not be read as a current unresolved lockout finding. Q's physical atomicity/GET500 and historical receipt limits remain unresolved. The optional Q+B combined crash rerun and direct pre-child bytes assertion were not added.
