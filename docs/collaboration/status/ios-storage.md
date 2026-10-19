# IOS-05 retained workbench session and named WebKit profiles

2026-10-18. Owner: inspect_library. Only writable paths: `ios/Forma/Infrastructure/WorkbenchSession.swift`, `ios/FormaNativeTests/WorkbenchSessionTests.swift` and this status. Lead owns AppStore, WorkbenchView, Keychain binding, project references and CI.

## Current state

Implementation and synthetic WebKit tests are written, awaiting real Mac/iOS Simulator compilation and execution. No local Swift or simulator is available on Windows.

- NativeWorkbenchSession owns a persistent, uniquely identified WKWebsiteDataStore and a retained WKWebView across sheet visits. Home/library/stats visits change only the hash of a healthy document. A language change or failed/terminated web process reloads the same profile, retaining its local state and media queue.
- `detach()` only removes the failure callback. `lock()` synchronously invalidates the session, cancels future cookie preparation, hides/stops/blanks/releases the old web view and ignores late callbacks.
- Cookie injection is serialised and cannot create a new page after lock. A late cookie write is removed before its profile becomes eligible for deletion.
- Navigation and responses retain same-origin, no-popup, no-download, MIME and attachment checks. Attach also requires the expected account and permitted entry route.
- Library is explicitly excluded from backup before creating a named profile; inability to set or verify that resource value throws. No health file contents are read.
- WorkbenchProfiles stores only queued UUIDs in UserDefaults. Drain callers share one task; full website data is removed before profile deletion. A short bounded retry allows sheet references and cookie writes to release; failure remains queued and throws a generic error.
- Four synthetic WK tests cover retained in-memory draft, localStorage restoration after session/view recreation under the same named profile, same-origin cookie/storage isolation between two profiles, purge verification from a recreated profile, and a lock before a queued asynchronous attach. They use synthetic HTML and loopback only.

## Validation

- Windows has no Swift/xcrun; these Swift files and WebKit tests have not been compiled or executed locally. Lead's Mac CI is the acceptance gate.
- No user data, .env, deployed API, actual media or personal health record was read.
- No files outside the three assigned paths were modified; no commits, installs or pushes were performed.

## API and integration

- `@MainActor NativeWorkbenchSession.init(id:UUID, origin:URL, accountId:String) throws`
- Readonly `id`, `origin`, `accountId`, `dataStore`, `webView`; optional `onFailure` callback.
- `attach(url:URL,cookie:HTTPCookie) async throws -> WKWebView`, `detach()`, `lock()`.
- `@MainActor WorkbenchProfiles.enqueue(_ id:UUID)` and `drain() async throws`.
- Lead binds the UUID to server/account in Keychain, retains the session between sheets, locks before account changes, and reports/retries queued cleanup failure. No default WebKit profile is used.

## Sources

API signatures and the iOS 17 availability were checked against Apple's [named profile API documentation](https://developer.apple.com/documentation/webkit/wkwebsitedatastore), [profile deletion contract](https://developer.apple.com/documentation/webkit/wkwebsitedatastore/remove(foridentifier:completionhandler:)) and WebKit's [profile API introduction](https://webkit.org/blog/14423/building-profiles-with-new-webkit-api/). The WebKit contract requires releasing WKWebViews before deleting their profile; the retry queue does not treat a failed removal as successful.
