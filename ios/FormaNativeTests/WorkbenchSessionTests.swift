import Foundation
import WebKit
import XCTest
@testable import Forma

final class WorkbenchSessionTests: XCTestCase {
    // No deployed service or personal API is contacted. The provisional request is stopped
    // immediately and replaced by synthetic HTML under this loopback origin.
    private let origin = URL(string: "http://127.0.0.1:9")!

    @MainActor func testDetachKeepsMemoryAndNamedProfileRestoresDraftAfterViewRecreation() async throws {
        try await WorkbenchProfiles.drain()
        let id = UUID(), account = UUID().uuidString.lowercased()
        var session: NativeWorkbenchSession? = try NativeWorkbenchSession(id: id, origin: origin, accountId: account)
        var web: WKWebView? = try await session!.attach(url: entry(account: account), cookie: cookie("a"))
        var reopened: WKWebView?
        var cleaned = false
        defer { if !cleaned { session?.lock(); WorkbenchProfiles.enqueue(id) } }
        XCTAssertTrue(session!.dataStore.isPersistent)
        XCTAssertEqual(session!.dataStore.identifier, id)
        try await fixture(in: web!, session: session)
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

        // Simulate the native session/view being discarded while retaining its Keychain UUID.
        // The next session must read the named profile, not the previous JS heap.
        session!.lock()
        reopened = nil
        web = nil
        session = nil
        session = try NativeWorkbenchSession(id: id, origin: origin, accountId: account)
        web = try await session!.attach(url: entry(account: account), cookie: cookie("a"))
        try await fixture(in: web!, session: session)
        let restored = try await string(web!, "localStorage.getItem('forma.synthetic.activeDraft') || 'missing'")
        let newHeap = try await string(web!, "typeof window.activeDraft")
        XCTAssertEqual(restored, "synthetic-completed-set")
        XCTAssertEqual(newHeap, "undefined")
        session!.lock()
        web = nil
        session = nil
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
        var firstWeb: WKWebView? = try await first!.attach(url: entry(account: firstAccount), cookie: cookie("a"))
        var secondWeb: WKWebView? = try await second!.attach(url: entry(account: secondAccount), cookie: cookie("b"))
        var cleaned = false
        defer {
            if !cleaned {
                first?.lock(); second?.lock()
                WorkbenchProfiles.enqueue(firstID); WorkbenchProfiles.enqueue(secondID)
            }
        }
        try await fixture(in: firstWeb!, session: first)
        try await fixture(in: secondWeb!, session: second)
        _ = try await string(firstWeb!, "localStorage.setItem('forma.synthetic.owner', 'account-A'); 'written'")
        _ = try await string(secondWeb!, "localStorage.setItem('forma.synthetic.owner', 'account-B'); 'written'")
        let firstCookies = await cookies(first!.dataStore)
        let secondCookies = await cookies(second!.dataStore)
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
        first!.lock(); second!.lock()
        firstWeb = nil; secondWeb = nil
        first = nil; second = nil
        WorkbenchProfiles.enqueue(firstID); WorkbenchProfiles.enqueue(secondID)
        // Two callers share the same drain rather than racing profile deletion.
        async let one: Void = WorkbenchProfiles.drain()
        async let two: Void = WorkbenchProfiles.drain()
        _ = try await (one, two)
        cleaned = true
    }

    @MainActor func testPurgeRemovesCookieAndDraftFromRecreatedNamedProfile() async throws {
        try await WorkbenchProfiles.drain()
        let id = UUID(), account = UUID().uuidString.lowercased()
        var session: NativeWorkbenchSession? = try NativeWorkbenchSession(id: id, origin: origin, accountId: account)
        var web: WKWebView? = try await session!.attach(url: entry(account: account), cookie: cookie("c"))
        var cleanWeb: WKWebView?
        var cleaned = false
        defer { if !cleaned { session?.lock(); cleanWeb?.stopLoading(); WorkbenchProfiles.enqueue(id) } }
        try await fixture(in: web!, session: session)
        _ = try await string(web!, "localStorage.setItem('forma.synthetic.activeDraft', 'synthetic-to-delete'); 'written'")
        session!.lock()
        web = nil
        session = nil
        WorkbenchProfiles.enqueue(id)
        try await WorkbenchProfiles.drain()

        let cleanStore = WKWebsiteDataStore(forIdentifier: id)
        let remaining = await cookies(cleanStore)
        XCTAssertFalse(remaining.contains { $0.name == "forma_session" })
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = cleanStore
        cleanWeb = WKWebView(frame: .zero, configuration: configuration)
        try await fixture(in: cleanWeb!, session: nil)
        let draft = try await string(cleanWeb!, "localStorage.getItem('forma.synthetic.activeDraft') || 'missing'")
        XCTAssertEqual(draft, "missing")
        cleanWeb!.stopLoading()
        cleanWeb!.navigationDelegate = nil
        cleanWeb!.loadHTMLString("", baseURL: nil)
        cleanWeb = nil
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
        let active = try XCTUnwrap(session)
        var failures = 0
        active.onFailure = { failures += 1 }
        let target = entry(account: account), token = try cookie("d")
        let attaching = Task { @MainActor in try await active.attach(url: target, cookie: token) }
        active.lock()
        do { _ = try await attaching.value; XCTFail("A locked session attached") }
        catch { }
        XCTAssertNil(active.webView)
        XCTAssertNil(active.onFailure)
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

    @MainActor private func cookies(_ store: WKWebsiteDataStore) async -> [HTTPCookie] {
        await withCheckedContinuation { continuation in store.httpCookieStore.getAllCookies { continuation.resume(returning: $0) } }
    }

    @MainActor private func string(_ web: WKWebView, _ script: String) async throws -> String {
        let value = try await web.evaluateJavaScript(script)
        return try XCTUnwrap(value as? String)
    }

    @MainActor private func fixture(in web: WKWebView, session: NativeWorkbenchSession?) async throws {
        let finished = expectation(description: "synthetic WK document finished")
        var failure: Error?
        let probe = WorkbenchFixtureNavigation(session: session) { error in failure = error; finished.fulfill() }
        web.stopLoading()
        web.navigationDelegate = probe
        web.loadHTMLString("<!doctype html><html><head><meta charset='utf-8'></head><body>Synthetic workbench fixture</body></html>", baseURL: origin.appendingPathComponent("training-workbench/"))
        await fulfillment(of: [finished], timeout: 15)
        web.navigationDelegate = session
        if let failure { throw failure }
    }
}

@MainActor
private final class WorkbenchFixtureNavigation: NSObject, WKNavigationDelegate {
    private weak var session: NativeWorkbenchSession?
    private var finished = false
    private let completion: (Error?) -> Void
    init(session: NativeWorkbenchSession?, completion: @escaping (Error?) -> Void) {
        self.session = session
        self.completion = completion
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !finished else { return }
        finished = true
        session?.webView(webView, didFinish: navigation)
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
