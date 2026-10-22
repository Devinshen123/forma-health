import Foundation
import WebKit
import XCTest
@testable import Forma

final class WorkbenchSessionTests: XCTestCase {
    // scripts/ios-contract-server.mts serves only synthetic HTML at this real HTTP origin.
    // An about:blank document with a baseURL is not a substitute for this navigation test.
    private let origin = URL(string: "http://127.0.0.1:3002")!

    @MainActor func testDetachKeepsMemoryAndNamedProfileRestoresDraftAfterViewRecreation() async throws {
        try await WorkbenchProfiles.drain()
        let id = UUID(), account = UUID().uuidString.lowercased()
        var session: NativeWorkbenchSession? = try NativeWorkbenchSession(id: id, origin: origin, accountId: account)
        var web: WKWebView? = try await open(session!, account: account, character: "a")
        var reopened: WKWebView?
        var cleaned = false
        defer { if !cleaned { session?.lock(); WorkbenchProfiles.enqueue(id) } }
        XCTAssertTrue(session!.dataStore.isPersistent)
        XCTAssertEqual(session!.dataStore.identifier, id)
        let actualOrigin = try await string(web!, "location.origin")
        XCTAssertEqual(actualOrigin, origin.absoluteString)
        let wrote = try await string(web!, "window.activeDraft = { exercise: 'synthetic', done: 1 }; localStorage.setItem('forma.synthetic.activeDraft', 'synthetic-completed-set'); 'written'")
        XCTAssertEqual(wrote, "written")
        session!.detach()
        reopened = try await session!.attach(url: entry(account: account, route: "stats"), cookie: cookie("a"))
        XCTAssertTrue(reopened === web)
        let memory = try await string(reopened!, "JSON.stringify(window.activeDraft)")
        let saved = try await string(reopened!, "localStorage.getItem('forma.synthetic.activeDraft') || 'missing'")
        let route = try await string(reopened!, "location.hash")
        XCTAssertEqual(memory, #"{"exercise":"synthetic","done":1}"#)
        XCTAssertEqual(saved, "synthetic-completed-set")
        XCTAssertEqual(route, "#/stats")

        let previousView = WeakWorkbenchView(web)
        session!.lock()
        reopened = nil
        web = nil
        session = nil
        try await released(previousView)
        // A fresh session/view with the same persisted profile UUID restores localStorage,
        // while the old document's in-memory variable cannot survive view destruction.
        session = try NativeWorkbenchSession(id: id, origin: origin, accountId: account)
        web = try await open(session!, account: account, character: "a")
        let restored = try await eventually(web!, "localStorage.getItem('forma.synthetic.activeDraft') || 'missing'",
                                           equals: "synthetic-completed-set")
        let newHeap = try await string(web!, "typeof window.activeDraft")
        XCTAssertEqual(restored, "synthetic-completed-set")
        XCTAssertEqual(newHeap, "undefined")
        let finalView = WeakWorkbenchView(web)
        session!.lock()
        web = nil
        session = nil
        try await released(finalView)
        WorkbenchProfiles.enqueue(id)
        try await WorkbenchProfiles.drain()
        cleaned = true
    }

    @MainActor func testProfilesOnOneOriginKeepCookiesAndLocalStorageSeparate() async throws {
        try await WorkbenchProfiles.drain()
        let firstID = UUID(), secondID = UUID()
        let firstAccount = UUID().uuidString.lowercased(), secondAccount = UUID().uuidString.lowercased()
        var first: NativeWorkbenchSession? = try NativeWorkbenchSession(id: firstID, origin: origin, accountId: firstAccount)
        var second: NativeWorkbenchSession? = try NativeWorkbenchSession(id: secondID, origin: origin, accountId: secondAccount)
        var firstWeb: WKWebView? = try await open(first!, account: firstAccount, character: "a")
        var secondWeb: WKWebView? = try await open(second!, account: secondAccount, character: "b")
        var cleaned = false
        defer {
            if !cleaned {
                first?.lock(); second?.lock()
                WorkbenchProfiles.enqueue(firstID); WorkbenchProfiles.enqueue(secondID)
            }
        }
        _ = try await string(firstWeb!, "localStorage.setItem('forma.synthetic.owner', 'account-A'); 'written'")
        _ = try await string(secondWeb!, "localStorage.setItem('forma.synthetic.owner', 'account-B'); 'written'")
        let firstCookies = await profileCookies(firstID)
        let secondCookies = await profileCookies(secondID)
        XCTAssertEqual(firstCookies.filter { $0.name == "forma_session" }.map(\.value), [String(repeating: "a", count: 64)])
        XCTAssertEqual(secondCookies.filter { $0.name == "forma_session" }.map(\.value), [String(repeating: "b", count: 64)])
        let ownerA = try await string(firstWeb!, "localStorage.getItem('forma.synthetic.owner')")
        let ownerB = try await string(secondWeb!, "localStorage.getItem('forma.synthetic.owner')")
        XCTAssertEqual(ownerA, "account-A")
        XCTAssertEqual(ownerB, "account-B")
        XCTAssertThrowsError(try NativeWorkbenchSession(id: firstID, origin: origin, accountId: secondAccount))
        do {
            _ = try await first!.attach(url: entry(account: secondAccount), cookie: cookie("b"))
            XCTFail("A session attached to another account")
        } catch NativeAPIError.invalidSession { }
        let firstProbe = WeakWorkbenchView(firstWeb), secondProbe = WeakWorkbenchView(secondWeb)
        first!.lock(); second!.lock()
        firstWeb = nil; secondWeb = nil
        first = nil; second = nil
        try await released(firstProbe)
        try await released(secondProbe)
        WorkbenchProfiles.enqueue(firstID); WorkbenchProfiles.enqueue(secondID)
        async let one: Void = WorkbenchProfiles.drain()
        async let two: Void = WorkbenchProfiles.drain()
        _ = try await (one, two)
        cleaned = true
    }

    @MainActor func testPurgeRemovesCookieAndDraftFromRecreatedNamedProfile() async throws {
        try await WorkbenchProfiles.drain()
        let id = UUID(), account = UUID().uuidString.lowercased()
        var session: NativeWorkbenchSession? = try NativeWorkbenchSession(id: id, origin: origin, accountId: account)
        var web: WKWebView? = try await open(session!, account: account, character: "c")
        var cleanWeb: WKWebView?
        var cleaned = false
        defer { if !cleaned { session?.lock(); cleanWeb?.stopLoading(); WorkbenchProfiles.enqueue(id) } }
        _ = try await string(web!, "localStorage.setItem('forma.synthetic.activeDraft', 'synthetic-to-delete'); 'written'")
        let previousView = WeakWorkbenchView(web)
        session!.lock()
        web = nil
        session = nil
        try await released(previousView)
        WorkbenchProfiles.enqueue(id)
        try await WorkbenchProfiles.drain()

        // This helper returns cookie values, not a retained WKWebsiteDataStore. Neither the
        // store nor a configuration may stay in this test's scope during its final purge.
        let remaining = await profileCookies(id)
        XCTAssertFalse(remaining.contains { $0.name == "forma_session" })
        cleanWeb = makeRawView(profile: id)
        try await loadHTTP(into: cleanWeb!, url: entry(account: account))
        let draft = try await string(cleanWeb!, "localStorage.getItem('forma.synthetic.activeDraft') || 'missing'")
        XCTAssertEqual(draft, "missing")
        let finalView = WeakWorkbenchView(cleanWeb)
        cleanWeb!.stopLoading()
        cleanWeb!.navigationDelegate = nil
        cleanWeb!.removeFromSuperview()
        cleanWeb = nil
        try await released(finalView)
        WorkbenchProfiles.enqueue(id)
        try await WorkbenchProfiles.drain()
        cleaned = true
    }

    @MainActor func testLockPreventsQueuedAttachFromCreatingAView() async throws {
        try await WorkbenchProfiles.drain()
        let id = UUID(), account = UUID().uuidString.lowercased()
        var session: NativeWorkbenchSession? = try NativeWorkbenchSession(id: id, origin: origin, accountId: account)
        var cleaned = false
        defer { if !cleaned { session?.lock(); WorkbenchProfiles.enqueue(id) } }
        var failures = 0
        session!.onFailure = { failures += 1 }
        let target = entry(account: account), token = try cookie("d")
        let attaching = Task { @MainActor [weak session] in
            guard let session else { throw NativeAPIError.staleSession }
            return try await session.attach(url: target, cookie: token)
        }
        session!.lock()
        do { _ = try await attaching.value; XCTFail("A locked session attached") }
        catch { }
        XCTAssertNil(session!.webView)
        XCTAssertNil(session!.onFailure)
        XCTAssertEqual(failures, 0)
        session = nil
        WorkbenchProfiles.enqueue(id)
        try await WorkbenchProfiles.drain()
        cleaned = true
    }

    @MainActor private func entry(account: String, route: String = "home") -> URL {
        var parts = URLComponents(url: origin.appendingPathComponent("training-workbench/"), resolvingAgainstBaseURL: false)!
        parts.queryItems = [URLQueryItem(name: "account", value: account), URLQueryItem(name: "lang", value: "en")]
        parts.fragment = "/" + route
        return parts.url!
    }

    @MainActor private func cookie(_ character: String) throws -> HTTPCookie {
        try XCTUnwrap(HTTPCookie(properties: [
            .name: "forma_session", .value: String(repeating: character, count: 64),
            .domain: "127.0.0.1", .path: "/", .expires: Date().addingTimeInterval(3_600),
            HTTPCookiePropertyKey("HttpOnly"): "TRUE"
        ]))
    }

    @MainActor private func profileCookies(_ id: UUID) async -> [HTTPCookie] {
        await withCheckedContinuation { continuation in
            autoreleasepool {
                WKWebsiteDataStore(forIdentifier: id).httpCookieStore.getAllCookies { cookies in
                    DispatchQueue.main.async { continuation.resume(returning: cookies) }
                }
            }
        }
    }

    @MainActor private func makeRawView(profile id: UUID) -> WKWebView {
        autoreleasepool {
            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = WKWebsiteDataStore(forIdentifier: id)
            return WKWebView(frame: .zero, configuration: configuration)
        }
    }

    @MainActor private func string(_ web: WKWebView, _ script: String) async throws -> String {
        let value = try await web.evaluateJavaScript(script)
        return try XCTUnwrap(value as? String)
    }

    /// WebKit writes localStorage to its persistent store asynchronously, so a value written
    /// moments earlier can still be absent from a brand-new session's first read. Poll for it
    /// rather than racing the flush. This does not weaken the caller's assertion: a value that
    /// never arrives is returned as it is and fails the comparison exactly as before.
    @MainActor private func eventually(_ web: WKWebView, _ script: String, equals expected: String,
                                       timeout: TimeInterval = 5) async throws -> String {
        var value = try await string(web, script)
        let deadline = Date().addingTimeInterval(timeout)
        while value != expected, Date() < deadline {
            try await Task.sleep(nanoseconds: 100_000_000)
            value = try await string(web, script)
        }
        return value
    }

    @MainActor private func open(_ session: NativeWorkbenchSession, account: String, character: String) async throws -> WKWebView {
        let ready = expectation(description: "real HTTP workbench document finished")
        var failure: Error?
        var completed = false
        let finish: (Error?) -> Void = { error in
            guard !completed else { return }
            completed = true
            failure = error
            ready.fulfill()
        }
        session.onDocumentReady = { finish(nil) }
        session.onFailure = { [weak session] in finish(session?.lastFailure ?? FixtureFailure.navigationFailed) }
        let web = try await session.attach(url: entry(account: account), cookie: cookie(character))
        await fulfillment(of: [ready], timeout: 45)
        session.onDocumentReady = nil
        session.onFailure = nil
        if let failure { throw failure }
        guard completed else { throw FixtureFailure.navigationFailed }
        return web
    }

    @MainActor private func loadHTTP(into web: WKWebView, url: URL) async throws {
        let ready = expectation(description: "real HTTP purge verification document finished")
        var failure: Error?
        let probe = WorkbenchFixtureNavigation { error in failure = error; ready.fulfill() }
        web.navigationDelegate = probe
        web.load(URLRequest(url: url))
        await fulfillment(of: [ready], timeout: 45)
        web.navigationDelegate = nil
        if let failure { throw failure }
        guard probe.finished else { throw FixtureFailure.navigationFailed }
    }

    @MainActor private func released(_ probe: WeakWorkbenchView) async throws {
        let deadline = Date().addingTimeInterval(3)
        while !probe.isReleased && Date() < deadline { try await Task.sleep(nanoseconds: 50_000_000) }
        XCTAssertTrue(probe.isReleased, "WKWebView remains retained after lock; profile removal would still be in use")
        guard probe.isReleased else { throw FixtureFailure.viewStillRetained }
    }
}

private enum FixtureFailure: Error { case navigationFailed, viewStillRetained }

@MainActor private final class WeakWorkbenchView {
    private weak var value: WKWebView?
    init(_ value: WKWebView?) { self.value = value }
    var isReleased: Bool { autoreleasepool { value == nil } }
}

@MainActor private final class WorkbenchFixtureNavigation: NSObject, WKNavigationDelegate {
    private(set) var finished = false
    private let completion: (Error?) -> Void
    init(completion: @escaping (Error?) -> Void) { self.completion = completion }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !finished else { return }
        finished = true
        completion(nil)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fail(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { fail(error) }
    private func fail(_ error: Error) {
        guard !finished, (error as NSError).code != NSURLErrorCancelled else { return }
        finished = true
        completion(error)
    }
}
