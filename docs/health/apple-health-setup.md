# Apple Health / Apple Watch setup

2026-10-23 implementation: the existing iOS 17+ Forma app now includes **Settings → Apple Health: read-only preview and upload**. This is native HealthKit, not web OAuth. Apple Watch samples first reach the iPhone Health store. A watchOS app, continuous heart-rate streaming and HealthKit writes are outside this slice.

## What the user approves

1. Sign in to the intended Forma account in the iPhone app using a reachable, trusted **HTTPS origin**. The screen displays the destination account email and server. Windows `127.0.0.1` is not reachable as that address from an iPhone; it points to the phone itself.
2. Tap **Request read access and preview locally**. The app requests only seven read types: steps, active energy, heart rate, resting heart rate, HRV SDNN, sleep analysis and workouts. `toShare` is empty; there are no HealthKit write/delete operations.
3. Review the local samples, their times, original source and sleep stage. This action does not upload samples. A successful permission-sheet request is never displayed as confirmation that all read permissions were granted. An empty type can mean no matching data, denial, limited history or an already caught-up cursor.
4. Separately select the upload-consent toggle, then **Confirm upload of this preview**. The exact preview, including source UUID deletion events, is sent to the displayed account/server. Imported samples remain separate from user-authored facts. No health sample is sent to AI by this flow.
5. Read another preview after uploading to fetch further pages. Each type is limited to 200 HealthKit changes per preview. Partial type failures are shown; failed types do not advance their cursor. Users manage Health permissions through iOS Settings or Health.

## Developer setup on Mac

- Open `ios/Forma.xcodeproj`, select the Forma scheme and the intended development team/unique Bundle Identifier. Enable HealthKit for that app identifier and make the signing profile match. The repository's `ios/Config/Forma.entitlements` contains `com.apple.developer.healthkit`; Debug and Release use it through `CODE_SIGN_ENTITLEMENTS`. No background-delivery entitlement is requested.
- `ios/Config/Info.plist` includes `NSHealthShareUsageDescription`. There is no write request or `NSHealthUpdateUsageDescription` because the app does not write Health data.
- The local generator `node scripts/ios-generate-project.mjs` maintains Swift build references and app entitlements. Run it after adding Swift files, then `node ios/verify-health-config.mjs` to check references, capability settings and static boundaries.
- Use a physical iPhone with the appropriate signing entitlement to validate permission sheets, protected-data/locked-device behavior, real Apple Watch sources and HealthKit deletion delivery. Synthetic simulator tests do not establish actual device permission or Watch sync.
- Supply a reachable Forma HTTPS server running the health routes. Do not weaken `NativeAPI` origin validation, redirect blocking, ephemeral cookies or `X-Forma-Account` checks to work around deployment problems.
- An Apple OAuth client ID/secret is **not** required for HealthKit. Sign in with Apple is a separate unimplemented feature. Distribution and Health data privacy declarations need their own App Store review and correct developer-account capability setup; code presence is not a signed IPA or a released app.

## Sync and deletion contract

The first query for each type starts at `now - 7 days` with `strictStartDate`. Its start remains fixed alongside the opaque HealthKit anchor; later foreground reads obtain additions and deletions in that same tracked window. There is no unlimited initial history scan, automatic background scheduler or guaranteed real-time delivery. Long intervals beginning before the first window are not initially imported.

The preview pins `GET /api/health/connections` → Apple `syncRevision` once. Every `POST /api/health/apple-health/import` carries `{consent:true,expectedRevision,records,deletedIds}` with at most 200 additions plus deletions combined. A disconnect or delete on the website increments the revision; stale previews and remaining chunks receive 409. The phone discards that preview and requires a new read/review. It never silently fetches a new revision to retry stale consent.

Each record uses the original `HKSample.uuid` lowercased as `id`, the original HealthKit `HKSource.bundleIdentifier`/name as source, and optional device local identifier/name/model/product type. Metadata is allowlisted; clinical data, contacts, route GPS and arbitrary HealthKit metadata are not copied. Original sample timezone is preserved when supplied; `deviceTimezoneAtImport` is explicitly separate. Energy uses kcal, heart rate bpm, HRV **SDNN** ms, and sleep/workout durations minutes. Sleep stage intervals remain individual, including in-bed/awake; overlapping stages and multiple sources are not summed. Workout active-energy metadata is not added again to activity energy.

Source UUIDs make retries idempotent. A type's candidate anchor is persisted only after **all** of its request chunks return a valid server acknowledgement. If a later chunk or cursor write fails, the unchanged preview/cursor can replay the same UUIDs without duplication. Earlier fully acknowledged types keep their cursor. If no type contains a change, no upload action is available and new empty cursors are not committed.

Only opaque anchors and their fixed start dates are stored locally, in account+server+type namespaces hashed with SHA-256. The directory is excluded from backup and protected with complete file protection. Sample previews stay in memory and clear on leaving the screen or changing account/server/session. Existing `AppStore` generation and exact `NativeAPI` identity are checked before/after every asynchronous operation. Signing out invalidates the client and cancels pending work. An HTTP request already received by the backend cannot be retroactively withdrawn by closing the screen.

HealthKit does not disclose denied read access. Revoking permission must not be interpreted as deletion of existing imports, and an empty query never deletes server history. Source deletion events returned by HealthKit are applied only for the same account and Apple provider. Use the website's separate imported-history delete action for explicit removal. To reimport after a server-history delete, choose **Reset cursors to read the last 7 days again**, confirm, and create a new preview; resetting local cursors does not delete remote history. Opaque cursor files may remain across sign-out but cannot expose sample values or be used for another account/server.

## Validation and remaining work

- Added `HealthImportTests` in FormaCore: explicit null vs zero, SDNN distinction, finite values, exact JSON contract, source UUID replay, 200-item request boundaries, consent and unchanged expected revision across chunks.
- Added native `HealthSampleMapperTests`: synthetic SDNN seconds→milliseconds, stable UUIDs, sleep-stage intervals, local-session invalidation. These construct synthetic samples only and never query the Health store or prompt for real authorization.
- Synthetic mapper tests explicitly inject a source descriptor because newly constructed, unsaved HealthKit objects have no `sourceRevision`. Production provenance extraction rejects a missing revision instead of fabricating the current app as the sample's source. A native regression case verifies nil provenance and unsaved samples fail closed.
- Lead verified [Mac CI run 40061328110](https://github.com/Devinshen123/forma-health/actions/runs/40061328110) at `6e02aa0`: Swift compilation, Core 25/25, new Health mapper 4/4, NativeAPI 6/6, UI 4/4 and unsigned Release archive succeeded. The overall workflow **failed** on the unchanged `WorkbenchSessionTests.testDetachKeepsMemoryAndNamedProfileRestoresDraftAfterViewRecreation` assertion restoring synthetic localStorage. No direct link to the Health changes was found in read-only review, but its cause is not established; the complete iOS regression suite cannot be called passing. Physical-device HealthKit remains unverified.
- Windows has no `swift`, `xcrun` or Xcode. Static verification is runnable here; Swift compilation, simulator results and any GitHub Mac CI result must be recorded separately by the lead. No physical Health store or Apple Watch has been accessed during implementation.
- On Mac, run `swift test --package-path ios/Packages/FormaCore`, then `xcodebuild test -project ios/Forma.xcodeproj -scheme Forma -destination 'platform=iOS Simulator,name=<installed iPhone simulator>' CODE_SIGNING_ALLOWED=NO`. The existing synthetic native HTTP integration case requires its isolated API fixture and `FORMA_LIVE_API=YES`; do not point it at the user's real database.
- Physical-device acceptance: grant only some types and verify other types stay empty; deny all and verify no false “authorized” state; inspect a real Watch source; upload reviewed samples; repeat the same preview after an interrupted response; delete a previously imported Health sample and sync deletion; disconnect/delete from the web during a multi-page upload and verify 409; change server/account during a query and verify stale preview/requests cannot enter the new account; test locked storage and relaunch; reset cursors after explicit server-history deletion. These remain pending until explicitly run with a tester's permission.

Official sources read for this implementation:

- [HealthKit authorization and privacy of read permissions](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [Swift concurrency anchored queries and bounded batches](https://developer.apple.com/documentation/healthkit/hkanchoredobjectquerydescriptor)
- [Anchored query results: samples, deleted objects and new anchor](https://developer.apple.com/documentation/healthkit/hkanchoredobjectquerydescriptor/result)
- [Generic sample predicates](https://developer.apple.com/documentation/healthkit/hksamplepredicate)
- [Workout quantity statistics](https://developer.apple.com/documentation/healthkit/hkworkout/statistics(for:))
- [Source revision exists only after retrieving a saved HealthKit object](https://developer.apple.com/documentation/healthkit/hkobject/sourcerevision)
