HANDOFF PROVENANCE: Real official Claude Code CLI, session eac1956d-3640-4789-bba7-07e5ebc3688f. Initial reviewed HEAD 14eb6da5640e0561df8e850953c346e04d310a7e. The completed reports below are copied verbatim from CLI result fields. Original review calls were read-only; test execution actors are identified separately.

# FORMA F-18: Claude Code frontend cross-review

**Reviewer:** real Claude Code session `eac1956d-3640-4789-bba7-07e5ebc3688f`, continuing from the preflight.
**Mode:** read-only. I used Read/Grep, read-only git and `ls`/`sha256sum`/`diff`, and a Python script that only reads the results JSON files. I did not run any tests, builds or services, made no edits or commits, and read no credentials. Every test result below is **Codex's execution**. I checked those logs, metadata and JSON; I did not rerun anything.

## 1. SHAs reviewed

| Item | Value |
|---|---|
| Frontend worktree | `...\task-2\forma-record-flows`, branch `codex/forma-frontend-boundaries-20261018` |
| HEAD reviewed | `14eb6da5640e0561df8e850953c346e04d310a7e` (`[qa] verify account remount upload and offline queue lifecycle in browser`) |
| Baseline | `85912f2d85f5758e88686950c870990a8acf008a` |
| `git diff 85912f2..14eb6da` | 6 files: CLAUDE.md, TASKS.md, the task file, Codex status, Codex report, and `tests/browser/sleep-report-lifecycle.mts` (+160/−2). **`git diff 85912f2..14eb6da -- src server` is empty, so no product code changed.** |
| Script in the passing runs vs committed | `focused-r2.source.mts`, `full-24.source.mts` and the working file all hash `42d8560e…352a6c`. The committed blob hashes `a6147a01…`, which is the same content with LF line endings. Converted to CRLF it gives `42d8560e…`. `core.autocrlf=true`. **So the committed script is the exact script that produced 8/8 and 24/24.** |
| HEAD during the runs | All three runs record `headBefore/After = a266346` with the script as an uncommitted change. 14eb6da committed that script unchanged (hash above). |
| User changes | `git status`: ` M AGENTS.md` plus four ` D` deletions, including `src/catalog/exercises.json`. `git diff --cached` is empty, so nothing is staged and nothing was restored. The tree still has the catalog blob `a5d423f2…`, but the working copy is missing it, so this workspace is **not** buildable. |
| Other directions (heads only; not reviewed) | Backend `forma-review-recovery` is at **`6739b927eb5c760d8232df970998a11401240d26`**, not the `d824f31` named in the handoff. `d824f31` is an ancestor; two later backend commits (`6ea52c0`, `6739b92`) exist. Review `forma-health` is at `5d003c24…` as stated. I did not review backend or review-direction code. These F-18 runs used the baseline backend, not B-18. |

## 2. Verdict

**Accepted at component-harness scope.** I found **no newly introduced defect**. Product files are unchanged, and the test-only diff adds real assertions.

Basis:
- The committed script hash-matches the source of the passing runs.
- Exact counts are in the logs and JSON (section 3).
- Each new assertion traces to real product mechanisms, not to harness shortcuts (section 4).

This is not a claim of unconditional safety. Three test-strength gaps are listed as non-blocking requests in section 5.

## 3. Evidence I checked (all Codex runs)

All runs are under `D:\CodexTaskData\forma-codex-claude-20261018\frontend`. Command for each: `node --import tsx tests/browser/sleep-report-lifecycle.mts`, using the runtime hook and TEMP set in each metadata file.

| Run | Metadata | Log | results.json |
|---|---|---|---|
| `focused-8` (initial) | exit 1, filter `account-remount\|stale-delete-confirmation-remote-delete`, 06:23:01–06:25:38Z | 2 PASS / 6 FAIL | 8 tests, 2 passed, `pageErrors: []` |
| `focused-r2` | exit 0, same filter, 06:26:31–06:26:37Z | 8 PASS | 8 tests, 8 passed, `pageErrors: []` |
| `full-24` | exit 0, no filter, 06:27:15–06:27:31Z | 24 PASS | 24 tests, 24 passed, `pageErrors: []` |

`codex-delivery.json` matches these counts.

**Initial failures:**
- Five cases failed with `locator.click: Timeout 30000ms` because the open `<dialog>` (or its `.dialog-header`) blocked the fixture's "Reload synthetic account" button. This is fixture-only: the native modal blocks pointer input.
- `reports-account-remount-offline-queue` failed with `private attachment owner boundary 401 !== 200`. The observer had cloned A's cookie through `storageState()`, and `register(B)` in the same context retired A's session.
- A diff of `focused-8.initial-source.mts` against the final source (CRLF ignored) shows exactly these two fixes and nothing else:
  - `.click()` became `.dispatchEvent('click')` in `reloadAccount`.
  - Cloned `storageState` observers became the new `observeAccount()` helper, which does its own login.
- No assertion was weakened or removed between the first and final runs.

**Provenance caveat:** `focused-8.metadata.json` records `sourceSnapshotRecordedAfterStart: true, sourceEditedDuringRun: true`. The initial snapshot is therefore **not provably the exact executed source**. The failure messages are consistent with it, but treat that run as diagnostic only. It is not red-before-green proof, and it was never claimed as a product red case.

## 4. Does each new assertion show the behavior it claims?

### `{sleeps,reports}-account-remount-editor` and `-delete` — confirmed

- A's editor opens with local edits (quality 5 / value `11`), or A's delete confirmation opens.
- B registers in the same browser context, which retires A's cookie. B gets a record with the **same ID** (sleep quality 2; report value `30` with B's own PDF).
- The POST `/api/sync` listener is attached **before** the remount. It records zero writes across remount, and B's server snapshot equals `b.before`.
- B's reopened editor shows B's values (`2` / `30`), so A's draft did not carry over. Exactly one write follows, with header `x-forma-account = B` (results.json shows B's ID and a mutation ID for all 4 cases).
- A's full `/sync` snapshot, read through an independent A login, is deep-equal before and after.
- For reports, A's PDF is byte-identical for A and returns 404 to B.

What this proves about the product:
- The harness sets `key={kind+engine.user.id}` (`lifecycle.mts:62`), which mirrors App's `features:${user.id}:${epoch}` key (`App.tsx:361`).
- Unmounting sets `mounted.current=false` (`Reports.tsx:136-142`, `Sleep.tsx:37-41`), and every submit/remove path bails out on it.

It does **not** test the App shell's account switching or its `writeBinding` save path.

### `reports-account-remount-delayed-upload` — confirmed, with one gap

- The upload response is held by `route.fetch` until after B's remount. On release, `Reports.tsx:310-315` runs: `uploadFile(..., ownerAccount)`, then sees `!mounted.current`, then discards and **returns before `save`**.
- So "no stale report POST" is enforced by **product code**. The harness's own `save` guard (`lifecycle.mts:46`, `engineRef.current!==engine`) is never reached in this case.
- The captured POSTs are `[POST /api/assets with A's header]` and no `/api/sync` POST. The DELETE carries A's header from `ownerAccount` (`Reports.tsx:125-130`), even though `boot()` has already set `setAccountHint(B)`.
- The server returns 401 because the header doesn't match the B cookie (`server/app.ts:214-220`).
- Both snapshots are unchanged. A's original PDF and the late PDF are readable by A, the late PDF returns 404 to B, and B's own PDF is intact.
- **Gap:** the test checks only status `401`. It does not check `code: 'ACCOUNT_CHANGED'`, so a missing or expired session would also pass (request R1).

### `reports-account-remount-offline-queue` — confirmed, with one gap

Real `SyncEngine.enable(true)` persists to IndexedDB keyed by `user.id` (`storage.ts:20`). A's save with the sync POST aborted gives `pending 1`. The cached queue holds one mutation referencing the new `assetId`, and the server snapshot for A is unchanged.

After remounting to B:
- Consent shows `disabled`, since consent is a per-account localStorage key (`engine.ts:23`).
- Retry adds no writes, A's cached queue is deep-equal to before, and B has no cache (`undefined`).
- B's snapshot is unchanged, and the cross-account PDF reads return 404.

After restoring A's cookie and remounting:
- Status is `pending 1`. With the block lifted, retry ends `synced`.
- Every captured write has A's header and the original mutation ID. results.json shows 2 writes total: the first aborted, the second replayed.
- A's server record equals the expected record including `assetId`. A's queue is now empty, the PDF bytes are intact, and B's snapshot plus PDF are unchanged.

`engine.ts:88` (`getMe` must match `this.user.id` before flushing) and `engine.ts:94` (`syncMutation(batch, this.user.id)`) are the product mechanisms involved.

**Gap:** `countBeforeBRetry` is taken *after* B's `boot()`/`restore()`. A write made during B's boot carrying A's header would pass both the "B retry" check and the final `every(account===A)` check. The run itself had exactly 2 writes, so it didn't happen, but nothing asserts that (request R2).

### Stronger remote-delete checks — confirmed

`posts.length === 0` was added at `lifecycle.mts:265`. The listener is attached after `h.mutate`/`h.refresh` and before the stale confirmation click, so an extra POST that the server ignores now fails the test.

## 5. Findings, in priority order

**No newly introduced product or test defect was found.**

| # | Severity | Type | Finding | Owner / request |
|---|---|---|---|---|
| R1 | Low | Test-strength gap (new test) | `lifecycle.mts` delayed-upload case: `assert.equal((await cleanup).status(), 401)` doesn't tell `ACCOUNT_CHANGED` apart from any other 401 (for example a missing session). | Codex frontend, later serial handoff: also assert `(await (await cleanup).json()).code === 'ACCOUNT_CHANGED'`. |
| R2 | Low | Test-strength gap (new test) | Offline-queue case: no bound on writes during B's `boot()`/`restore()`. The run had 2 writes total, but this isn't asserted. | Codex frontend: assert `writes.length === 1` immediately before `reloadAccount(h, b.user.id)` and again after it, before the B retry. |
| R3 | Info | Test robustness | In the delayed-upload `route` handler, `assert.equal(response.status(), 201)` runs inside the Playwright route callback. If it fails, it surfaces as a 30 s `expect.poll` timeout or an unhandled rejection rather than a clear failure. | Optional cleanup: record the status and assert it in the test body. |
| K1 | Medium | **Pre-existing known risk, not introduced** | An account switch during a held upload leaves A's late PDF **as an unreferenced private asset in A's storage**. The client discard is fire-and-forget (`Reports.tsx:314` and `:140`, `.catch(()=>{})`), with no durable cleanup intent, and the server correctly rejects the cross-account DELETE. The test **asserts this retention** as the conservative behavior. That is a fair ownership choice, but it is orphan growth, not cleanup. | Product/backend policy decision. This is separate from backend B-18's PUT cleanup intents. |
| K2 | — | Pre-existing known unresolved issue | Physical cleanup rollback / bytes loss is still a known unresolved red case. A backend fix that blocks **new** references to missing bytes (backend `6ea52c0`/`6739b92`, not reviewed here) is a different claim from recovering bytes that were already lost. F-18 tested neither. | — |
| E1 | Info | Evidence provenance | The `focused-8` initial source snapshot was taken after the run started and was edited during it. That run is diagnostic only. | Already disclosed in Codex metadata; no action. |
| H1 | Info | Harness design | `reloadAccount` uses `dispatchEvent('click')` on a fixture control because the native modal blocks pointer input. All product interactions use real `click`/`fill`/`selectOption`. This is labeled in code comments and in both MDs. It is acceptable, but it is **not** a user-reachable account-switch path. | — |
| H2 | Info | Test infrastructure | The Vite alias now resolves `react`, `react-dom`, `scheduler` and `lucide-react` through `require.resolve` under the process-only runtime hook. Nothing is written to shared `node_modules`. On a complete install it resolves normally. | — |

## 6. Optional extra tests (not required for acceptance)

1. R1 and R2 above.
2. An App-shell-level account switch (login B in another tab, then the A tab's `SyncPanel`/`writeBinding` path) to cover what this harness explicitly does not.
3. A test that A's orphaned late upload (K1) shows up somewhere the user or a future cleanup policy could act on it. This needs a product decision first.

## 7. Limitations

- **Not verified:** full App account shell, SyncPanel or Training; TypeScript or `npm run build` (impossible while `exercises.json` is deleted); mobile viewport in this run; iPhone/Safari/WebKit; real AI; real health data; a combined frontend+backend (B-18) revision.
- The old integrated 215/18/build results are historical baseline evidence and were not rerun here.
- JSON export includes attachment metadata and references, not image/PDF bytes. Server `/api/export` also leaves out the unsynced client outbox. JSON alone is never a full backup.
- I did not touch the running integrated website, Showroom/Mail tabs, services, or other sessions' histories. Skill files actually read (preflight, SHA-verified): `C:\Users\devin\.claude\skills\security-review\SKILL.md` (`fe6f9151…`) and `C:\Users\devin\.claude\skills\playwright\SKILL.md` (`c52cc951…`). They were used as review guidance only; I invoked no slash command or wrapper script.

## Actual same-session Claude-authored R1/R2 supplement

# F-18 Claude supplement: R1 and R2 edits made, test run blocked

**Status: BLOCKED.** I made the two assertion edits, but the approved runner stopped at its own line 18, before `node` started. **No browser test ran in this step, so R1 and R2 are not closed.** I did not retry, did not change the runner, and started no other command, service or browser.

## 1. Who did what

| Step | Who | Result |
|---|---|---|
| 24/24 full and 8/8 focused runs | Codex, earlier | Historical; their evidence is under `focused-r2/` and `full-24/` |
| Cross-review | Me, read-only, earlier | Accepted at component scope; raised R1 and R2 |
| **This step** | Me, as sole writer of the test script | Two edits made; the one allowed runner call exited 1 before any test ran |

## 2. Changes

Only `tests/browser/sleep-report-lifecycle.mts` changed: +7/−1, uncommitted and unstaged. HEAD is still `14eb6da5640e0561df8e850953c346e04d310a7e`. No product, task, status, report, AGENTS or catalog file was touched, and the four user deletions remain unstaged.

- Script SHA-256 before: `42d8560e68d0ad98850fd9b6485f2b72eb14c8edf85b48b05651e91a35352a6c`
- Script SHA-256 after: **`0f8dabc8c3e5a293c92c6336fdb0456abbc9eed16d89cd78e08a8ce9e8a311d2`**

**R1, in `reports-account-remount-delayed-upload` (lines 346–349).** The existing 401 check is kept. It now also reads the same response's body and requires the `ACCOUNT_CHANGED` code:
```diff
-      release(); assert.equal((await cleanup).status(), 401, 'late A cleanup cannot act with B session cookies');
+      release(); const cleanupResponse = await cleanup;
+      assert.equal(cleanupResponse.status(), 401, 'late A cleanup cannot act with B session cookies');
+      // A missing/expired session is also 401; require the account-mismatch rejection specifically.
+      assert.equal((await cleanupResponse.json()).code, 'ACCOUNT_CHANGED', 'late A cleanup is rejected as an account mismatch, not a missing session');
```

**R2, in `reports-account-remount-offline-queue` (lines 381 and 386–387).** The count is now pinned to exactly one write before the switch to B, and again after B's boot/restore but before B's retry:
```diff
       assert.deepEqual(await http(observerA, 'GET', '/sync', h.user.id), beforeA, 'aborted queue has not reached the server');
+      assert.equal(writes.length, 1, 'only the original aborted A write precedes the account switch');
       const b = await secondAccount(h, 'reports'); observerB = await observeAccount(b.user);
       ...
       await expect(h.p.getByRole('status', { name: 'Synthetic offline consent', exact: true })).toHaveText('disabled');
+      // An A-header replay during B boot/restore would otherwise pass the later account/mutation checks.
+      assert.equal(writes.length, 1, 'B boot/restore submits no write, including an A-header replay');
       const countBeforeBRetry = writes.length;
```
All earlier assertions are unchanged, including: no extra B retry write, A's queue unchanged, A/B PDF bytes and owner checks, and the replay using the same A mutation ID with A's header.

## 3. What happened when I ran it

- **Command (called once through Bash):** `powershell.exe -NoProfile -File 'D:\CodexTaskData\forma-codex-claude-20261018\run-forma-frontend-supplement-20261018.ps1'`
- **Exit code:** 1
- **Error:**
  ```
  Get-FileHash : The term 'Get-FileHash' is not recognized as the name of a cmdlet ...
  At ...run-forma-frontend-supplement-20261018.ps1:18 char:198
  ```
- **Where it stopped:** the runner builds its metadata on line 18 and starts `node` on line 19. The error on line 18 stopped it under `$ErrorActionPreference='Stop'`. So there is no `tests.log`, no `tests.metadata.json`, no `results.json`, and no focused or full count. pageErrors is not available.
- **What it left on disk:** only `D:\...\frontend\claude-supplement-focused-2\executed-source.mts`, whose SHA-256 is `0f8dabc8…11d2` (matches my edited script). `claude-supplement-full-24` was never created.
- **Retry is blocked by design:** the runner's guard on line 12 throws if an evidence directory already exists. `claude-supplement-focused-2` now exists, so running it again unchanged would fail immediately. I left the directory alone.
- **Likely cause (not verified):** the runner calls Windows PowerShell 5.1 from Git Bash. In that setup `PSModulePath` probably doesn't point to the module that provides `Get-FileHash` (`Microsoft.PowerShell.Utility`), so the cmdlet can't be found. The runner script itself is fine apart from that.

## 4. What the coordinator needs to decide

To get R1 and R2 run, the coordinator needs to make a fresh runner handoff that:
- either deletes or renames `claude-supplement-focused-2`, or sends output to new directory names;
- and either launches the runner from a real PowerShell host or uses a hashing approach that works in this setup.

Neither touches product code or the test script. The edited script (`0f8dabc8…`) is ready to commit as it stands, but it has **not been run**. Do not record R1 or R2 as passing until a fresh run exits 0.

## 5. Limits (unchanged)

- Component-harness scope only. Not tested: the full App account shell, build/tsc (blocked anyway while `exercises.json` is deleted), iPhone/Safari, real AI, real health data, or frontend combined with the B-18 backend.
- Not addressed, as instructed: orphan-retention policy (K1), R3, physical crash atomicity.
- Physical cleanup rollback / bytes loss is still a known unresolved red case. Backend blocking new references to missing bytes is a separate claim.
- JSON export has attachment metadata and references but not image/PDF bytes, and server export leaves out the unsynced client outbox. JSON alone is not a full backup.

The test slot is released, and I am stopping all writes here. I made no commits and staged nothing.

## Coordinator resolution of the runner-host failure

The original attempt stopped before Node, as the raw report states. No denial was bypassed. A new PowerShell7 runner with fresh D evidence directories validated the unchanged Claude-authored source SHA256 0F8DABC8C3E5A293C92C6336FDB0456ABBC9EED16D89CD78E08A8CE9E8A311D2: focused2/2 and full24/24, exit0/pageErrors0. These later runs were executed by the coordinator, not by Claude. See frontend/claude-supplement-focused-2-r2 and frontend/claude-supplement-full-24-r2 metadata/results. R1/R2 are closed by those actual assertions and passing runs; the original failure receipt remains intact.
