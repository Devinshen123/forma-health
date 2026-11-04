# Cloud review — 2026-11-04

- **Scope:** origin/main `7017064` (website + server); iOS branch `codex/forma-iphone-app-20261022` at `4494a48` (reviewed as `origin/main...branch` under `ios/`).
- **Rules followed:** report only. No product code was changed. `data/` and `.env` were not read. All probes used synthetic accounts in throwaway temporary directories.
- **Environment:** Linux cloud container, Node v22.23.4. There is no Swift toolchain and no Xcode.
- **Evidence labels:** **run** means confirmed by running code. **read** means confirmed by reading code. **read (subagent)** means found by a review subagent and not re-checked line by line by the lead. **plausible** means likely but not proven.

## 1. Checks on origin/main

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | OK |
| `npm test` (`node --import tsx --test server/*.test.ts server/rules/*.test.ts tests/*.test.ts`) | 0 | 471 tests, 471 pass, 0 fail (about 47 s) |
| `npx tsc --noEmit` (typecheck; there is no separate script, it is the first step of `build`) | 0 | OK |
| lint | n/a | `package.json` has no lint script |
| `npm run build` | **1** | Failed in `prebuild`; see below |
| Build steps after `prebuild` run by hand: `vite build` + workbench / island / source / release-info / offline-shell scripts, after `npm ci --prefix vendor/opengym/frontend` and `npm ci --prefix vendor/pokemon-island` | 0 | OK. Release identity `7017064…`, 5632 exercises, 6 companions, offline shell has 417 files. Vite warns about large chunks (`Training-*.js` is 2.56 MB). |

**Why the build failed:** `scripts/import-opengym-catalog.mjs:47` throws `Missing or changed authorized asset: exercise-media/opengym/clip/0001.mp4`. The licensed exercise media is only in the GitHub Release `forma-20261022` (README §2). The release download returned 401 from this container (private repository). This is an environment limit, not a code defect. A full `npm run build` still needs a machine that has the release ZIP.

## 2. iOS on codex/forma-iphone-app-20261022

- **`swift test --package-path ios/Packages/FormaCore`: not run.** There is no `swift` binary in this container.
- **App, UI and native tests:** `FormaNativeTests` and `FormaUITests` need Xcode and the iOS simulator, so they cannot run here.
- Everything below was found by reading the Swift code against `server/sync.ts`, `server/app.ts`, `server/store.ts` and `server/validation.ts` on main.

## 3. Findings (most severe first)

### F1 — High — An unconfirmed delete blocks every later save until the app restarts (iOS) — read
- **Code:** `ios/Forma/App/AppStore.swift:200`, `:125-126`, `:224-227`, `:272-276`, `:154-155`.
  - `deleteRecord` parks `pending = (key, .null, mutation)`.
  - `load()` clears `pending` only when `records(collection).contains(pending.value)`. That is never true for `.null`.
  - `retryUnconfirmedSave` calls `saveRecord(value: .null)`. That fails the `value["id"].stringValue` guard at `:146` and throws `invalidSession`, so the delete is never resent.
  - `restoreParkedSave` brings the slot back after re-login, because `!records.contains(.null)` is always true.
- **Scenario:**
  1. The user deletes a meal. The server commits, but the response is lost (timeout).
  2. After a refresh the meal is gone, but `pending` remains.
  3. Every save of any other record now throws `409 PENDING_SAVE` at `:154`.
  4. "Retry" fails with `invalidSession`.
  5. The only path that clears the slot is `deleteRecord` on the same id (`:185-188`), and the UI can't reach it because that row no longer exists.
  6. Signing out and back in re-parks the slot.
- **Fix direction:** treat `.null` pending as a delete. Clear it in `load()` and `restoreParkedSave` when the id is absent, and let the retry resend the stored mutation directly.

### F2 — High — Retrying a food-photo save creates duplicate meals (iOS; the server accepts them) — read
- **Code:** `ios/Forma/Features/FoodPhotoView.swift:281-289` rebuilds each record with `NativeRecords.reviewedEstimate`. That calls `meal()`, which mints a new `UUID()` and a new `createdAt` every time (`NativeRecords.swift:49,55`). Items are saved in a loop, one mutation each.
- **Scenario:** a draft has two items. Item 1 commits and item 2 fails on the network. The user saves again: item 1 gets a new id, so the attempt is refused with `PENDING_SAVE`. After the pending slot is resolved, the next save writes item 1 a second time.
- **Server side:** `validateOwnedState` (`server/app.ts:342-347`) does not reject two meals that point to the same `aiDraftId` + `aiItemIndex`, so daily intake is double-counted.
- Other editors cache the built record (`cachedRecord`); this flow does not.

### F3 — High — A plan or onboarding retry silently saves the old values (iOS) — read
- **Code:** `AppStore.swift:624-627` reuses `pendingPlan.mutation` whenever `pendingPlan.key == key`. The keys are fixed strings: `"edit"` (`:573`) and `"onboarding"` (`:603`).
- **Scenario:**
  1. The user edits trainingDays from 3 to 4, and the save times out.
  2. The editor sheet stays editable. The user changes it to 5 and saves.
  3. The stored mutation (4) is resent and succeeds, and the sheet closes.
  4. The user believes 5 was saved.
- Re-answered onboarding questions behave the same way.
- **Fix:** include the content hash in the key, or block edits while a plan save is unconfirmed.

### F4 — High — Editing a web meal whose `referenceGrams` isn't 100 changes its nutrition (iOS) — read (subagent)
- **Code:** `ios/Forma/Features/NutritionView.swift:95-100,189-190` and `NativeRecords.swift:52`.
  - The iOS editor fills in the stored per-reference macros but labels them "per 100 g".
  - It always writes `"referenceGrams": 100` (`NativeRecords.swift:52`).
  - The website allows any `referenceGrams` (`src/features/mealEditor.ts`).
- **Scenario:** a web meal with `referenceGrams 30, kcal 120, grams 60` is 240 kcal. After any iOS edit (even a rename) it is 120 kcal per 100 g × 60 g = 72 kcal.
- If the per-reference values exceed the iOS caps (kcal > 1200, macros > 111 g), the edit is refused instead.

### F5 — Medium — Attachments have no per-account quota, and uploads that are never referenced are never deleted (server + iOS) — **run**
- **Server:** `server/app.ts:406-421` and `server/store.ts:299-313`.
  - `POST /api/assets` has no quota and no rate limit.
  - Cleanup only covers assets that a record *used to* reference (`store.ts:188-191`, `app.ts:356-362`).
  - The training-workbench media does have a quota (`WORKBENCH_MEDIA_QUOTA`), but these attachments do not.
- **Probe:** one synthetic account uploaded 40 × 1 MiB PNGs. All got 201. 40 files and 41,943,040 bytes stayed on disk with zero referencing records.
- **iOS makes it worse:**
  - `ReportsView.swift:391-415` uploads an attachment as soon as it is picked. Cancelling, or picking another file, leaves it behind.
  - `FoodPhotoView.swift:240-251` uploads before analysis. A failed analysis, a re-pick or a cancel leaves the photo behind.
  - `deleteOrphanAttachment` is never called in these paths.
- **Effect:** health documents and meal photos the user discarded stay in the account and appear in `/api/export`. One authenticated account can also fill the disk.

### F6 — Medium — One rate-limit bucket per IP is shared by every user and every sensitive route (server) — **run**
- **Code:** `server/app.ts:203-225`. The same in-memory bucket (60 requests per 15 min, keyed only by `req.ip`) is used by:
  - login, register and account delete;
  - forgot/reset password, verify email, change password, and the OAuth start/complete routes (`server/auth/router.ts:20-46`);
  - every billing route, including `POST /api/billing/sync` (`server/billing/router.ts:11-14`).
- **Probe:** 60 failed logins for `attacker@example.test`. Then `victim@example.test` tried to register from the same IP and got **429**.
- **Scenario:** behind NAT or carrier-grade NAT (an office or mobile network), one client lock everyone out of sign-in. Ordinary billing polling also uses up the sign-in budget. With `FORMA_TRUST_PROXY_HOPS=0` behind a proxy, which is the Dockerfile default (`Dockerfile:14`), every client shares one bucket. The deployment doc does say to set the hop count.
- There is also no per-account limit, so password guessing spread across many IPs is not throttled.

### F7 — Medium (plausible High) — Default iPhone photos (HEIC) are rejected (iOS) — plausible
- **Code:** `FoodPhotoView.swift:99,228-235` and `ReportsView.swift:280,394-398` use `PhotosPicker(matching: .images)` + `loadTransferable(type: Data.self)`. That returns the original file bytes.
- `Attachment.type(of:)` (`FormaCore/Attachment.swift`) and the server (`app.ts:62-68`) accept only PNG, JPEG, WebP, GIF and PDF.
- Nothing converts HEIC to JPEG, so camera-roll HEIC photos would be refused as unsupported.
- **Needs a device test.**

### F8 — Medium — A 409 conflict leaves editors locked on an outdated version (iOS) — read (subagent)
- **Code:** `AppStore.swift:170,208` clears `pending` on 4xx but ignores the `snapshot` the server returns (the error carries it, `NativeAPI.swift:83`), so `versions` stay outdated.
- The editors are `.disabled(saving || cachedRecord != nil)`. Retrying conflicts again until the user refreshes manually. After the refresh, a retry overwrites the remote change without showing it to the user.
- Any 400 locks the form the same way, so the user can't correct the input.

### F9 — Medium — Retrying a new report always shows a false "changed elsewhere" message (iOS) — read (subagent)
- **Code:** `FormaCore/Report.swift:162` sets `createdAt ?? wireInstant(Date())`, and `ReportsView.swift:353` rebuilds the record on every tap.
- The pending value therefore differs on each retry, `saveRecord` throws `PENDING_SAVE` (`AppStore.swift:154`), and the user sees "This report changed elsewhere".

### F10 — Medium — The food-photo size limit and AI errors don't match the server (iOS) — read (subagent)
- **Code:** iOS accepts photos up to 10 MB (`Attachment.swift:7,37`). `/api/food-photo-drafts` refuses anything over 5 MB (`server/app.ts:279`) with `AI_IMAGE_INVALID` (400).
- iOS `message()` maps every 400 to "check dates, portions and values".
- No AI code (503 not configured, 429 budget, 422, 502/504) has its own message.

### F11 — Low — Text length is counted differently on iOS and the server (iOS) — read (subagent)
- **Code:** `Report.swift:131,142,144-146` and `Onboarding.swift:84,92` use `String.count` (visible characters). The zod `.max()` limits count UTF-16 units.
- **Scenario:** a 100-emoji report name passes on iOS and gets a 400 from the server.
- `NativeRecords` already uses `utf16.count` correctly.

### F12 — Low — Smaller issues (iOS) — read (subagent)
- `saveRecord` / `deleteRecord` throw `invalidSession` when `isBusy` (`AppStore.swift:145,181`), so a background refresh shows the user "result could not be confirmed".
- iOS allows `aiItemIndex < 64` (`NativeRecords.swift:70`); the server caps it at 7 (`validation.ts:75`).
- The comment at `FoodPhoto.swift:57-67` says bad items are dropped one by one, but `try?` on the whole array drops all of them.

## 4. Checked and found correct

- **Sync request format (iOS ↔ server):**
  - `{mutationId, changes:[{collection,id,baseVersion,kind,value}]}` matches the strict schema in `server/sync.ts:8-28`.
  - A delete leaves out `value`, and an upsert's id equals `value.id`.
  - `baseVersion` comes from `entityVersions` and defaults to 0.
  - The `mutationId` is reused on an identical retry. Combined with the server receipt (`store.ts:175-179`), a repeat is not applied twice.
  - The server's `tests/ios-contract.test.ts` covers the round trip, idempotent retry, the stale-version 409, and the Origin and account-header checks (all pass).
- **Origin / account header:** `NativeAPI.swift:74-75` sends a normalized `scheme://host[:port]` Origin and `X-Forma-Account`, and refuses redirects. A probe confirmed the server returns 403 to a native write without Origin.
- **Demo mode:** every server write path is guarded (record save/delete, plan, upload, analysis, companion, workbench, export, account delete). Only the language preference is persisted.
- **Account isolation (server):**
  - Every state, asset, draft, sync, workbench, health and companion query is scoped by `owner_id` (grep of all `prepare(...WHERE` without an owner key found only account/self, global-clock and token-hash lookups).
  - Records may reference only assets of the same owner (`app.ts:348-353`).
  - AI meals must point to the owner's own draft (`app.ts:342-347`).
  - A cookie with another account's `X-Forma-Account` header is rejected (`app.ts:236`).
- **Sessions:** 256-bit random tokens, stored as SHA-256 hashes; cookies are HttpOnly + SameSite=Strict (+Secure in production); 7-day expiry checked in SQL; the previous session is revoked when a new one is issued; changing the password deletes all of the owner's sessions (`auth/ledger.ts:99`); account deletion re-checks the session after the password hash is computed.
- **Uploads:** strict MIME list (no SVG), canonical base64 check, magic-byte check, 10 MB limit, file name sanitized, served with `nosniff` + `CSP sandbox`, and PDFs served as attachment.
- **OIDC:** a new identity whose email belongs to an existing account is refused (`auth/ledger.ts:155`), so an unverified provider email cannot take over an account.
- **zh/en:** no UI strings were found in only one language on iOS.

## 5. Not covered

- Swift unit tests, the iOS app and UI tests (no toolchain).
- A full `npm run build` that includes the licensed media check.
- Browser end-to-end scripts (`tests/browser/*.mts`).
- The billing and health provider network flows against real providers.
