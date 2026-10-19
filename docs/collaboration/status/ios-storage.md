# IOS-05 retained workbench session and named WebKit profiles

2026-10-18. Owner: inspect_library. Only writable paths: `ios/Forma/Infrastructure/WorkbenchSession.swift`, `ios/FormaNativeTests/WorkbenchSessionTests.swift` and this status. Lead owns AppStore, WorkbenchView, Keychain binding, project references and CI.

## Current state

The first real Mac run compiled the files but failed runtime acceptance. Lifecycle and fixture fixes are now written and awaiting the next real Mac/iOS Simulator run. No local Swift or simulator is available on Windows.

- NativeWorkbenchSession owns a persistent, uniquely identified WKWebsiteDataStore and a retained WKWebView across sheet visits. Home/library/stats visits change only the hash of a healthy document. A language change or failed/terminated web process reloads the same profile, retaining its local state and media queue.
- `detach()` removes UI callbacks. `lock()` synchronously invalidates the session, cancels future cookie preparation, hides/stops/detaches/releases the old web view and ignores late callbacks. It deliberately does not start an asynchronous blank navigation while profile deletion is pending.
- Cookie injection is serialised and cannot create a new page after lock. A late cookie write is removed before its profile becomes eligible for deletion.
- Navigation and responses retain same-origin, no-popup, no-download, MIME and attachment checks. Attach also requires the expected account and permitted entry route.
- Library is explicitly excluded from backup before creating a named profile; inability to set or verify that resource value throws. No health file contents are read.
- WorkbenchProfiles stores only queued UUIDs in UserDefaults. Drain callers share one task; full website data is removed before profile deletion. The temporary data store used by removeData is released via a separate callback helper and explicit autorelease pool before remove(forIdentifier:). A short bounded retry allows sheet references and cookie writes to release; failure remains queued and preserves the last underlying SDK error for callers. Production UI still maps it to generic text and does not print it.
- Four synthetic WK tests cover retained in-memory draft, localStorage restoration after session/view recreation under the same named profile, same-origin cookie/storage isolation between two profiles, purge verification from a recreated profile, and a lock before a queued asynchronous attach. They use real HTTP synthetic HTML at `http://127.0.0.1:3002/training-workbench/`, supplied by the lead's CI fixture server. No loadHTMLString/baseURL origin simulation remains.
- Tests await the real navigation delegate's ready callback, assert the actual HTTP origin, verify weak WKWebView references are released, and avoid retaining a data store/configuration/old session while purging.

## Validation

- Windows has no Swift/xcrun; these Swift files and WebKit tests have not been compiled or executed locally. Lead's Mac CI is the acceptance gate.
- Lead reported CI `39192510261`: six native networking tests passed; the first WK test's memory/localStorage assertions passed, but the hash assertion failed because loadHTMLString had an about:blank location and the production origin policy correctly refused its hash navigation. Profile cleanup then failed and the remaining WK tests failed at their queued-drain entry. The suite was not accepted. Those failed results are not overwritten by the new source.
- Source-level root cause was confirmed in WebKit's Cocoa implementation: removal refuses an existing store with an active page **or an existing network process**. Therefore keeping the temporary removeData store alive during profile deletion is invalid even when no WKWebView is visible. The initial lock also started an unnecessary new blank navigation. Both lifetimes are addressed rather than suppressing a queue error or removing assertions.
- No user data, .env, deployed API, actual media or personal health record was read.
- No files outside the three assigned paths were modified; no commits, installs or pushes were performed.

## API and integration

- `@MainActor NativeWorkbenchSession.init(id:UUID, origin:URL, accountId:String) throws`
- Readonly `id`, `origin`, `accountId`, `dataStore`, `webView`; optional `onFailure` callback. New optional one-shot `onDocumentReady` callback and readonly `lastFailure` enable real-navigation XCTest readiness/diagnostics without changing the app's existing attach/lock contract.
- `attach(url:URL,cookie:HTTPCookie) async throws -> WKWebView`, `detach()`, `lock()`.
- `@MainActor WorkbenchProfiles.enqueue(_ id:UUID)` and `drain() async throws`.
- Lead binds the UUID to server/account in Keychain, retains the session between sheets, locks before account changes, and reports/retries queued cleanup failure. No default WebKit profile is used.

## Sources

API signatures and the iOS 17 availability were checked against Apple's [named profile API documentation](https://developer.apple.com/documentation/webkit/wkwebsitedatastore), [profile deletion contract](https://developer.apple.com/documentation/webkit/wkwebsitedatastore/remove(foridentifier:completionhandler:)) and WebKit's [profile API introduction](https://webkit.org/blog/14423/building-profiles-with-new-webkit-api/). The WebKit contract requires releasing WKWebViews before deleting their profile; the retry queue does not treat a failed removal as successful.

The additional network-process check is visible in WebKit's [WebsiteDataStoreCocoa.mm, removeDataStoreWithIdentifier](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/WebsiteData/Cocoa/WebsiteDataStoreCocoa.mm#L303). This is why the data-clearing helper does not retain its temporary WKWebsiteDataStore into the profile-removal call.

## Lead 最终 Mac 验证（2026-10-18）

GitHub CI 39193436826 / a5b65f3 已实际成功：Core 21/21、Native API/WebKit 10/10、UI 4/4，零失败/跳过，模拟器编译与无签名 iPhone Release archive通过。本角色代码已冻结交回lead；这些是lead的Mac CI结果，不是Windows本地运行。真机安装、签名与TestFlight尚未完成。
