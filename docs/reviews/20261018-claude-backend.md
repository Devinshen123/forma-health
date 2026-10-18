HANDOFF PROVENANCE: Real official Claude Code CLI, session 7bd94c31-1d67-4b13-85e4-b196ac699a2d. Initial reviewed HEAD 6739b927eb5c760d8232df970998a11401240d26. The completed reports below are copied verbatim from CLI result fields. Original review calls were read-only; test execution actors are identified separately.

# FORMA B-18 cross-review: PUT cleanup retry and missing-byte guard

**Reviewer:** Claude Code, session `7bd94c31-1d67-4b13-85e4-b196ac699a2d`, read-only. I made no edits and ran no tests, builds or services. All test results below come from Codex or Q-18 runs whose logs and metadata I read. I did not re-run anything.

## 1. What I reviewed

| Item | SHA |
|---|---|
| Submitted backend HEAD | `6739b927eb5c760d8232df970998a11401240d26` (branch `codex/forma-put-cleanup-retry-20261018`) |
| Common product baseline | `85912f2d85f5758e88686950c870990a8acf008a` |
| PUT intent fix | `d824f31d6c646db9e34899ea2df32d8f5a46cf07` |
| Missing-byte guard | `6ea52c00422a85ed21bb3aa326511972564bad1a` |
| Commit after the guard | Changes only the status and report MD files (`git diff --stat 6ea52c0..HEAD`) |
| Q-18 review head (evidence only) | `5d003c24b2facbba902ba5dcbbaecd1d4a562c22` |

The frontend head `14eb6da` was not part of this backend review.

- **Workspace:** `git status` at HEAD shows only the user's `M AGENTS.md` and the four deletions, including `src/catalog/exercises.json`. None are staged or restored. `server/` has no diff against HEAD.
- **Scope:** across `85912f2..HEAD`, product and test changes touch only `server/app.ts`, `server/store.ts` and `server/state-cleanup-retry.test.ts`. That matches the writable scope.
- **Skills used:** I re-used the Claude `backend-patterns`, `security-review` and `database-migrations` SKILL.md files read during preflight. I read them by absolute path. I am not claiming any slash-command was registered.

## 2. Evidence checked

| Run (executor) | Command | Result | Is it bound to the reviewed source? |
|---|---|---|---|
| Original PUT red (Codex) | `node --import tsx --test --test-concurrency=1 server/state-cleanup-retry.test.ts` | exit 1, 0/1. Assertion: "the committed removal retains durable authority…", got 200, expected 404 | **Partly.** `red-put-cleanup.log` has no metadata or source hash. Its stack points to test line 91, so it ran an earlier version of the test file. Plausible, but not hash-verified. |
| First green (Codex) | same | 1/1 | No metadata |
| Focused 17/17 and full 220/220 (Codex) | — | Earlier stage | Historical. Superseded by the guard runs. |
| Guard red (Codex) | `node --import tsx --test --test-concurrency=1 '--test-name-pattern=missing private bytes\|attachment validation under the save lock' server/state-cleanup-retry.test.ts` | exit 1, 0/3. All three cases got 200, expected 400 (test lines 196, 196, 225) | **Yes.** The metadata hashes for app and store (`EF743B…`, `1B7A26…`) equal the CRLF-checkout hashes of the `d824f31` files. The test hash `565B57…` equals the HEAD test file. This is a real red on pre-guard product code. |
| Guard green (Codex) | same | 3/3 | Log only |
| Focused (Codex) | `… server/state-cleanup-retry.test.ts server/approval-failure-recovery.test.ts` | exit 0, **20/20**: 8 PUT/missing-byte cases + 12 existing sync/approval cases. 0 fail, skip, cancel or todo. | Metadata present |
| Full suite (Codex) | `node --import tsx --test --test-concurrency=1 server/*.test.ts server/rules/*.test.ts tests/*.test.ts` | exit 0, **223/223**, 0 fail, skip, cancel or todo, 16.38 s | **Yes.** The source hashes (`4903A4…`, `7377C5…`, `565B57…`) equal the current working-tree files and the CRLF form of the `6ea52c0` blobs. HEAD is identical for `server/`. |
| Independent three-case replay (Q-18) | — | exit 0, 3/3 | **Yes.** Same three source hashes, recorded `reviewedProductCommit 6ea52c0` |
| Crash observation (Q-18, before the guard) | — | The child exited with code 73 before COMMIT. Asset metadata and intent were restored, but the file bytes were gone. A new reference was accepted with 200, and GET returned 500. | Baseline evidence for the physical-loss red case |

**Caveat on the full suite:** the metadata records `"head": d824f31` because the guard was not yet committed when the suite ran. The source binding comes from the file hashes, not from the head field. These runs use the runtime hook, a D-drive TEMP directory and the dirty workspace. They are not `npm test` or `npm run build`, and nothing was type-checked.

## 3. Verified behaviour (my own reading of the code)

**Durable PUT intent** (`store.ts:124-145`, key at `store.ts:23`)
- The intent rows are written inside the same `BEGIN IMMEDIATE` transaction (`store.ts:212-216`) as the state, revision and entity-version update. Only exact previous-to-next removals are recorded.
- The `INSERT … SELECT … FROM assets WHERE owner_id=? AND id=?` statement only matches this owner's existing assets, and it uses `?` binding.
- No DDL was added. The existing table and its foreign-key cascade are reused.
- The rollback test (an insert-trigger abort) shows state, revision and `/sync` entity versions all unchanged, and the same revision is reusable afterwards.

**Key collision**
- `syncMutationSchema.mutationId` uses `idSchema` (`sync.ts:25`). The tests and status file assume this is UUID-only; I did not read `idSchema`'s definition myself.
- Revisions only ever increase. Both PUT and sync use `revision=revision+1`, and I found no code path that resets them.
- So, assuming `idSchema` accepts only UUIDs, `put-state:<rev>` is unique per owner and cannot collide with a sync mutation ID.

**Stale 409 retry** (`app.ts` PUT handler)
- `putStateSchema.parse` and authentication both run before the stale branch. The tests confirm that malformed state (400) and a mismatched cookie and account hint (401) never reach cleanup.
- Cleanup candidates come only from the stored intent, never from the request payload. A payload referencing a foreign asset is not applied, and that asset is left alone.
- The 409 body and status are unchanged. If cleanup fails, the error is swallowed, the intent survives and the response is still 409.
- Repeated retries are idempotent: no extra revision and no rewrite.

**Owner and reference safety**
- `completeAssetCleanup` and `deleteUnreferencedAsset` (`store.ts:191-199`, `314-325`) re-check current references under the write lock.
- Tests cover: an attachment re-referenced before an old retry is protected; moving an attachment between records does not select it; unsaved uploads and other owners' assets are untouched; a cross-owner GET returns 404.

**Validator inside `BEGIN IMMEDIATE`**
- PUT now validates only inside `Store.save`, after the CAS revision check and before the UPDATE.
- Sync already validated inside its transaction (`store.ts` sync body). `/api/sync` and `/api/state` are the only state-writing callers (my grep of `store.sync`/`store.save`).

**Two-Store race test**
- This test (`state-cleanup-retry.test.ts:213-230`) proves validation happens after the second Store's deletion, i.e. inside `save` rather than in the route.
- It does not by itself prove the check runs after `BEGIN IMMEDIATE` rather than at function entry. The code shows it does.

**Missing-byte guard** (`store.ts:303-310`)
- It only checks file metadata (`statSync().isFile()`) and does not read the file.
- ENOENT and ENOTDIR mean "unavailable". Other errors are re-thrown and become 500.
- `Store.asset` keeps its metadata-only meaning, so exact cleanup can still remove a row whose bytes are already gone. The test asserts the 404 that results.

## 4. Findings, by priority

### F1: introduced, Medium. The guard rejects every save that still contains an existing broken reference, not just new references

- **Where:** `server/app.ts:305-307`. `validateOwnedState` checks `store.assetBytesAvailable` for every attachment referenced in the candidate state, not only references added relative to `previous`. Sync (`app.ts:324`) and PUT (`app.ts:353`) both apply it to the whole merged state.
- **Effect:**
  - If an account already has a record whose bytes are missing, every later PUT and every sync mutation is rejected with 400 "An attachment is unavailable or invalid…". That includes unrelated edits, such as logging a meal or syncing a sleep entry.
  - It lasts until the client deletes that record.
  - Offline-outbox clients would get repeated 400s on unrelated batches.
  - Before `6ea52c0` these saves succeeded with 200.
- **How the precondition arises:**
  - Q-18's own observation produced exactly this state: `currentReportReferencesMissingAsset: true`, created on pre-guard code.
  - It can also come from out-of-band file loss. Restoring a backup without the uploads folder is a realistic example, since JSON exports contain no bytes.
- **Docs contradict the code:** the status file and report say the guard stops missing bytes from "gaining a new reference" and "does not repair existing broken references". The code goes further and blocks the account. That claim is unsupported as written.
- **Context:** the rule that a missing *metadata row* rejects all saves already existed before this work. The new byte check widens a pre-existing all-references pattern into a common runtime condition.
- **Request to the Codex owner** (for a later serial handoff):
  - Either limit the byte check to references in `referencedAssets(next) \ referencedAssets(previous)`, keeping the metadata and MIME checks as they are, or have the coordinator explicitly accept "broken reference blocks all saves" as policy and document it.
  - Add an HTTP regression in both cases: with an existing reference whose bytes are missing, an unrelated PUT and an unrelated sync change succeed (or fail as documented), the broken reference is left as is, and removing that record succeeds.
- **Not shown by current tests:** no test exercises an unrelated edit while a broken reference exists. In both missing-byte tests the broken asset is unreferenced at the moment of the check.

### F2: known, unresolved. The database and the file system can still diverge on a crash

- `deleteUnreferencedAsset` deletes the row, then calls `rmSync` (`store.ts:323`), then COMMIT.
- If the process exits between `rmSync` and COMMIT, the row comes back but the bytes are lost. Q-18 observed this with exit 73.
- After that, GET returns 500, because `assetBytes`/`readFileSync` throws and is not mapped to 404 (`app.ts:388`). Nothing in this branch changes that.
- **Two separate claims, kept apart:**
  - (a) *Bounded guard (new, tested):* new references to such an asset are rejected inside the save lock.
  - (b) *Physical atomicity (still red):* bytes are not restored, the 500 on read is unchanged, and there is no journal, tombstone or fsync ordering.
- Neither the code nor the docs claim (b). It must stay listed as a known red case.

### F3: pre-existing behaviour, Low. A committed PUT can still return 500

- When post-commit cleanup fails, a successful PUT now goes through `finishMutationCleanup` and still answers 500 even though the save committed. That was the old contract too.
- The client's natural retry then gets 409 "changed in another window", which is confusing but harmless.
- This is documented in the report. Noted for UX, not a defect.

### F4: design note, Low. Any stale client can trigger pending cleanup

- Any authenticated, schema-valid stale PUT whose revision matches an intent finishes that intent. This includes a different tab that never saved, or a client trying older revision numbers.
- It can only complete removals that were already committed and are re-checked against current references, and the task permits it. It is not tied to the original payload. Recorded so nobody describes it as "only the same request".

### F5: observability, Low. The stale-path catch logs nothing

- The empty `catch {}` around stale cleanup swallows every error class, including SQLITE_BUSY and path-validation errors.
- The intent is kept, so this is safe, but there is no signal that cleanup keeps failing. A redacted log line (owner hash and error code only, no health content) would help.

### F6: minor, informational. The PUT response returns the input state

- `res.json({ state, … })` returns the input `state`, while `next = stateSchema.parse(state)` is what gets stored.
- The input was already parsed by the same schema, so the two should be identical unless a schema transform is not idempotent. I did not check every transform.

### Other checks: no new defect found

- I found no change to the HTTP contract, the response schema or how sync receipts behave, and no DDL, general garbage collection or upload scanning.
- I found no cross-owner path. File paths stay restricted by `assetPath`'s UUID and prefix checks.

## 5. Status

- **B-18 PUT intent work (`d824f31`): accepted on evidence.** Every task criterion is covered by real HTTP/SQLite tests:
  - a failed cleanup commits state once;
  - restart plus the same stale PUT returns 409 and the old attachment becomes 404;
  - an aborted intent write rolls back state, revision and entity versions;
  - owner, current-reference and unsaved-upload safety;
  - idempotent retries;
  - focused and full suites green, bound to the hashed source.

  The one gap is that the original red has no metadata (see the evidence table).
- **Missing-byte guard (`6ea52c0`): conditionally accepted, with F1 open.** The three reds were real. Codex's run and Q-18's independent run are both green, and the validation does run under the save lock. However, the guard is broader than its documented claim and introduces a narrow lockout. I recommend not integrating it until F1 is either narrowed (with a regression test) or explicitly accepted as policy.
- I am **not** claiming the change is unconditionally safe. F2 remains a known physical-loss red case.

## 6. Missing assertions and additional test requests (for the Codex owner)

1. The F1 regression described above. This is the meaningful one.
2. In the restart test, after the 409 retry, assert directly that `store.assetCleanupIntents(owner.id, 'put-state:<rev>')` is empty, rather than inferring it from the 404.
3. A test where a pending PUT intent and a pending sync intent cover the same asset (from two different removals). The Store-level sync version exists; a PUT plus sync mix does not.
4. A test where `assetBytesAvailable` hits a stat error other than ENOENT, such as a directory placed at the asset path. This checks the `isFile()` false branch and the 500 mapping.

## 7. Limitations

- I ran nothing. All counts are Codex or Q-18 executions verified through logs and metadata.
- `full-suite-guard` records head `d824f31` because the guard was uncommitted at the time. The source binding is by hash only.
- Not verified:
  - full TypeScript or `npm run build`; the dirty workspace lacks `exercises.json`, and a tracked baseline catalog blob does not make it buildable;
  - browser and full App shell;
  - iPhone and Safari;
  - real AI;
  - production data and migrations;
  - a real power-loss crash; Q-18's process exit is the closest proxy.
- The old integrated results (215 tests, 18 browser cases, build) are historical only.
- Old hash-only receipts can't be used to reconstruct removed assets. An intent that is never retried keeps its bytes indefinitely, because there is no retention policy.
- JSON export contains records and attachment metadata/references, not image or PDF bytes. Server export also excludes the unsynced client outbox. JSON alone is not a full backup.
- I did not inspect the integrated running site, the Showroom or Mail tabs and services, credentials, or other sessions' histories.

## Same-session final follow-up, reviewed HEAD 51a42a9a7f40e9909da76718da4864c5828a78be

# FORMA B-18 follow-up review: F1 fix

**Reviewer:** Claude Code, the same session `7bd94c31-1d67-4b13-85e4-b196ac699a2d`, read-only. I made no edits and ran no tests, builds or services. All test counts below are Codex or Q-18 runs whose logs and metadata I read. My original review of `6739b92` stays as it was; this is an addendum.

## 1. What I reviewed

| Item | SHA |
|---|---|
| Submitted backend HEAD | `51a42a9a7f40e9909da76718da4864c5828a78be` (branch `codex/forma-put-cleanup-retry-20261018`) |
| Product fix | `13402e11fcf64f16e1f2e66784b88c7210e819f1` |
| Previous reviewed HEAD | `6739b927eb5c760d8232df970998a11401240d26` |

- **Scope:** `6739b92..13402e1` changes only `server/app.ts` (+8/−2) and `server/state-cleanup-retry.test.ts` (+52/−1). `13402e1..51a42a9` changes only the backend status and report MD files.
- **Store:** `server/store.ts` is unchanged. Its hash `7377C5…` is the same as at the guard commit.
- **Workspace:** at HEAD, `git status` shows only the user's `M AGENTS.md` and the four deletions, including `src/catalog/exercises.json`. None are staged or restored. `server/` has no diff against HEAD.

## 2. F1 is resolved

**The fix** (`server/app.ts`, inside `validateOwnedState`):
- It builds `assetsWithNewAssociations`. For each of `meals` and `reports` separately, it maps each record ID in `previous` to its `assetId`.
- A next-state record goes into the set when it has an `assetId` and that record ID was either absent before or pointed to a different asset.
- The byte check (`assetBytesAvailable`) now runs only for assets in that set.
- The metadata check (`!asset`, owner-scoped through `store.asset(ownerId, …)`) and the meal MIME rule still apply to every referenced asset, as before this task.

**Why this closes F1:**
- An unchanged `(collection, record.id, assetId)` association no longer forces a byte check. Unrelated PUT and sync saves, edits to other fields of the same record, and removal of the broken record all go through.
- The check works per record, not as a global asset-set difference. So copying a broken asset to a new record, or pointing a different existing record at it, still counts as a new association and is rejected, even while the old association still exists. This matches the claim in the status and report, which is now accurate.
- `previous` is the state read inside the transaction:
  - PUT: `Store.save` calls the validator after `BEGIN IMMEDIATE` and the revision check.
  - Sync: `Store.sync` at `store.ts:164` calls `validate(snapshot.state, …)` inside its transaction.

  So deciding which associations are new cannot race another Store's commit.

**Edge cases I checked in the code:**
- **Moving a record between collections:** entity IDs are unique across all collections (`validation.ts:212-231`). A record that appears in `meals` with an ID previously used in `reports` is absent from the `meals` map, so it gets the byte check.
- **Deleting and re-creating a record ID:** the record is absent from `previous`, so it gets checked. Sync tombstones already block resurrection.
- **Duplicate IDs within one state:** rejected by the same uniqueness rule, so the `Map` cannot hide an association.
- **Switching an existing broken record to a good asset:** the good asset becomes a new association and is checked. That is correct.

**Earlier key-collision assumption, now settled:** `idSchema = z.string().uuid()` (`server/validation-primitives.ts:3`), and `syncMutationSchema.mutationId` uses it (`server/sync.ts:25`). `put-state:<n>` can never pass as a UUID, so internal PUT intent keys cannot collide with client sync mutation IDs.

## 3. The two new HTTP cases

One test definition runs for both `sync` and `put` (`state-cleanup-retry.test.ts:232-280`). Its fixture is a report linked to a PDF whose bytes are then deleted, followed by a restart. It asserts:
1. An unrelated new meal saves with 200. Revision goes up by 1, and the broken report is kept exactly as it was.
2. Renaming that report without changing its attachment returns 200.
3. A new report that copies the broken asset returns 400, and the `/sync` snapshot (state, revision, entity versions) is unchanged. Retrying with the same mutation UUID (sync) or the same revision (PUT) but an available candidate returns 200. That shows the refused request consumed neither.
4. Pointing a different valid record at the broken asset returns 400 with the snapshot unchanged. The corrected request with the same identity returns 200.
5. Deleting the broken report returns 200. A GET on the old asset then returns 404, so exact cleanup removed the metadata. The final reports and meals are as expected, and the candidate's bytes are intact.

**Gap:** this test has no second account, so it does not show other-owner bytes staying safe. That is still covered by the earlier missing-byte tests (lines 174-211), which assert the foreign asset's bytes and a cross-owner 404. Low priority. A foreign-asset copy attempt here would only duplicate the existing `!asset` owner check.

## 4. Evidence and hash binding

| Run (executor) | Command | Result | Is it bound to the reviewed source? |
|---|---|---|---|
| F1 red (Codex) | `node --import tsx --test --test-concurrency=1 '--test-name-pattern=existing broken references' server/state-cleanup-retry.test.ts` | exit 1, 0/2. Both sync and PUT failed at test line 247, "an existing broken association must not block an unrelated save": got **400, expected 200** | **Yes.** App `4903A4…` equals the CRLF form of the `6739b92` `app.ts`. Store `7377C5…` is unchanged. Test `ABAE53…` equals the CRLF form of the `13402e1` test file. A real red on pre-fix product code. |
| F1 green (Codex) | same | 2/2 | Log only |
| Focused (Codex) | `… server/state-cleanup-retry.test.ts server/approval-failure-recovery.test.ts` | exit 0, **22/22**, 0 fail, skip, cancel or todo | App `36D869…`, store `7377C5…`, test `ABAE53…` |
| Full suite (Codex) | `node --import tsx --test --test-concurrency=1 server/*.test.ts server/rules/*.test.ts tests/*.test.ts` | exit 0, **225/225**, 0 fail, skip, cancel or todo, 15.86 s | Same three hashes (see below) |
| Independent replay (Q-18) | `… --test-name-pattern 'existing broken references allow unrelated edits' server/state-cleanup-retry.test.ts` | exit 0, **2/2** | Before and after hashes match the same three. `reviewedProductCommit 13402e1`. Physical crash tests were not re-run. |

**Binding the 225 to the final source:** the full and focused metadata record `"head": 6739b92` because the fix was not committed yet. I computed SHA-256 of the CRLF checkout of `13402e1` and got app `36d869…`, store `7377c5…` and test `abae53…`, the same three hashes as the 225 run. The current working-tree files match too, and `server/` is identical at `51a42a9`. So the 225/225, 22/22 and Q-18's 2/2 all ran against the submitted product source. The `review-f1.patch` file's SHA-256 matches the handoff (`AA126D…`).

The earlier independent guard replay (3/3 on `6ea52c0`) is separate evidence and does not cover the F1 change.

All of these runs use the runtime hook, a D-drive TEMP directory and the dirty workspace. They are not `npm test` or `npm run build`.

## 5. New defects

**No newly introduced defect was established in `6739b92..51a42a9`.** This is not a claim of unconditional safety.

My earlier Low findings are unchanged by this fix and stay open as notes:
- **F3:** a committed PUT whose cleanup fails still returns 500. Pre-existing contract.
- **F4:** any authenticated, schema-valid stale PUT at the matching revision can trigger a pending exact cleanup. Allowed by the task, and references are re-checked.
- **F5:** the stale-path `catch {}` swallows errors without any log.
- **F6:** the PUT response returns the input `state`, while the stored value is `next`.

Optional test supplements are still open from my original review: an explicit "intent empty" assertion, a test mixing PUT and sync intents for the same asset, and a test for a stat error other than ENOENT.

## 6. Status

- **F1: resolved.** Codex reproduced it with a real red (400 where 200 was expected) on pre-fix source. The per-association rule behaves as specified, keeps the PUT and sync validators inside their transactions, and is backed by green focused and full runs bound by hash, plus Q-18's independent 2/2.
- **Missing-byte guard as a whole: accepted** within its bounded claim. It stops new or changed links to missing bytes, and an existing broken link no longer blocks the account.
- **F2 (known, unresolved red case):** the row delete → `rmSync` → COMMIT order can still lose bytes when a process exits before COMMIT. A read of such an asset still returns 500 (`assetBytes`/`readFileSync`). This guard does not restore bytes, repair the 500 or make the database and file system atomic together. "The backend prevents new broken references" and "the physical loss is fixed" are different claims, and only the first holds.

## 7. Limitations

- I ran nothing. All counts are Codex or Q-18 executions checked through logs, metadata and recomputed hashes.
- Not verified:
  - full TypeScript or `npm run build`; the dirty workspace lacks `exercises.json`, and a tracked baseline catalog blob does not make it buildable;
  - full App shell and browser;
  - combined cross-direction revision;
  - iPhone, Safari and real devices;
  - real AI;
  - production data and migrations;
  - a real power-loss crash.
- Old integrated results (215 tests, 18 browser cases, build) are historical only.
- Old hash-only receipts can't be used to reconstruct removed assets. An intent that is never retried keeps its bytes indefinitely, because there is no retention policy.
- JSON export contains records and attachment metadata/references, not image or PDF bytes. Server export also excludes the unsynced client outbox. JSON alone is not a full backup.
- I did not inspect the integrated running site, the Showroom or Mail tabs and services, credentials, or other sessions' histories.
