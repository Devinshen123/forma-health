import Foundation
import WebKit

enum WorkbenchStorageError: Error {
    case backupExclusionUnavailable
    case cleanupPending
}

/// One account/server/session profile. The native store owns this object across sheet visits.
@MainActor
final class NativeWorkbenchSession: NSObject, WKNavigationDelegate {
    let id: UUID
    let origin: URL
    let accountId: String
    let dataStore: WKWebsiteDataStore
    private(set) var webView: WKWebView?
    var onFailure: (() -> Void)?
    var onDocumentReady: (() -> Void)?
    private(set) var lastFailure: Error?

    private var valid = true
    private var requestedURL: URL?
    private var documentFinished = false
    private var documentLanguage: String?
    private var needsReload = false
    private var cookieTask: (id: UUID, task: Task<Void, Error>)?

    init(id: UUID, origin: URL, accountId: String) throws {
        guard WorkbenchProfiles.validIdentifier(id), UUID(uuidString: accountId) != nil else { throw NativeAPIError.invalidSession }
        let origin = try NativeAPI.server(origin.absoluteString)
        try NativeWorkbenchSession.excludeLibraryFromBackup()
        try WorkbenchProfiles.claim(id, origin: origin, account: accountId)
        self.id = id
        self.origin = origin
        self.accountId = accountId
        self.dataStore = WKWebsiteDataStore(forIdentifier: id)
        super.init()
    }

    func attach(url: URL, cookie: HTTPCookie) async throws -> WKWebView {
        guard valid, allowedEntry(url), validCookie(cookie) else { throw NativeAPIError.invalidSession }
        requestedURL = url
        // Serialise cookie renewal. A newer attach cannot be overwritten by an older completion.
        let previous = cookieTask?.task
        let ticket = UUID()
        let task = Task { @MainActor [weak self] in
            if let previous { _ = try? await previous.value }
            guard let self, self.valid, !Task.isCancelled else { throw NativeAPIError.staleSession }
            WorkbenchProfiles.beginCookieWrite(self.id)
            defer { WorkbenchProfiles.endCookieWrite(self.id) }
            await self.dataStore.httpCookieStore.setCookie(cookie)
            guard self.valid, !Task.isCancelled else {
                // A lock can happen while WebKit is setting the cookie. Never resurrect a view,
                // and remove that late cookie before the queued profile purge is allowed to run.
                await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                    self.dataStore.httpCookieStore.delete(cookie) { continuation.resume() }
                }
                throw NativeAPIError.staleSession
            }
        }
        cookieTask = (ticket, task)
        do { try await task.value }
        catch {
            if cookieTask?.id == ticket { cookieTask = nil }
            throw error
        }
        if cookieTask?.id == ticket { cookieTask = nil }
        guard valid else { throw NativeAPIError.staleSession }
        if let webView {
            if let destination = requestedURL, needsReload || documentLanguage != language(of: destination) {
                load(destination, in: webView)
            } else if documentFinished { try await updateHash(in: webView) }
            guard valid, self.webView === webView else { throw NativeAPIError.staleSession }
            return webView
        }
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = dataStore
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        let web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self // WebKit holds this delegate weakly.
        web.isOpaque = false
        web.allowsBackForwardNavigationGestures = true
        webView = web
        guard let destination = requestedURL else { throw NativeAPIError.staleSession }
        load(destination, in: web)
        return web
    }

    /// Closing the sheet does not end the document, timers, local draft or media queue.
    func detach() { onFailure = nil; onDocumentReady = nil }

    /// Synchronous invalidation comes before any asynchronous server/logout/profile cleanup.
    func lock() {
        guard valid else { return }
        valid = false
        onFailure = nil
        onDocumentReady = nil
        requestedURL = nil
        cookieTask?.task.cancel()
        cookieTask = nil
        if let web = webView {
            web.isHidden = true
            web.stopLoading()
            web.navigationDelegate = nil
            web.uiDelegate = nil
            web.removeFromSuperview()
            // Do not begin an asynchronous blank navigation here. That navigation can keep
            // the supposedly released WKWebView (and its profile) alive during removal.
        }
        webView = nil
        documentFinished = false
        documentLanguage = nil
    }

    private func load(_ url: URL, in web: WKWebView) {
        documentFinished = false
        documentLanguage = language(of: url)
        needsReload = false
        lastFailure = nil
        web.load(URLRequest(url: url))
    }

    private func language(of url: URL) -> String {
        URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "lang" })?.value == "en" ? "en" : "zh"
    }

    private func updateHash(in web: WKWebView) async throws {
        guard valid, webView === web, let fragment = requestedURL?.fragment else { throw NativeAPIError.staleSession }
        // Fragment is restricted by allowedEntry. No record or native credential enters script.
        do { _ = try await web.evaluateJavaScript("if (location.hash !== '#\(fragment)') location.hash = '\(fragment)';") }
        catch {
            guard valid, webView === web else { throw NativeAPIError.staleSession }
            needsReload = true
            lastFailure = error
            onFailure?()
            throw error
        }
        guard valid, webView === web else { throw NativeAPIError.staleSession }
    }

    private func sameOrigin(_ url: URL) -> Bool {
        url.scheme == origin.scheme && url.host == origin.host && url.port == origin.port
            && url.user == nil && url.password == nil
    }

    private func allowedEntry(_ url: URL) -> Bool {
        guard sameOrigin(url), url.path == "/training-workbench/" || url.path == "/training-workbench",
              let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              ["/home", "/library", "/stats"].contains(parts.fragment ?? "") else { return false }
        let accounts = (parts.queryItems ?? []).filter { $0.name == "account" }
        return accounts.count == 1 && accounts.first?.value == accountId
    }

    private func validCookie(_ cookie: HTTPCookie) -> Bool {
        let domain = cookie.domain.hasPrefix(".") ? String(cookie.domain.dropFirst()) : cookie.domain
        return cookie.name == "forma_session" && cookie.path == "/" && domain == origin.host
            && cookie.isHTTPOnly && (origin.scheme != "https" || cookie.isSecure)
            && (cookie.expiresDate.map { $0 > Date() } ?? false)
    }

    private static func excludeLibraryFromBackup() throws {
        var library = try FileManager.default.url(for: .libraryDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        do {
            try library.setResourceValues(values)
            guard try library.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true else {
                throw WorkbenchStorageError.backupExclusionUnavailable
            }
        } catch { throw WorkbenchStorageError.backupExclusionUnavailable }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard valid, self.webView === webView, let url = action.request.url,
              action.targetFrame != nil, sameOrigin(url), !action.shouldPerformDownload else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        guard valid, self.webView === webView, let url = response.response.url else { decisionHandler(.cancel); return }
        let disposition = (response.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition") ?? ""
        decisionHandler(sameOrigin(url) && response.canShowMIMEType && !disposition.lowercased().contains("attachment") ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard valid, self.webView === webView else { return }
        documentFinished = true
        needsReload = false
        Task { @MainActor [weak self, weak webView] in
            guard let self, let webView, self.valid, self.webView === webView else { return }
            do {
                try await self.updateHash(in: webView)
                guard self.valid, self.webView === webView else { return }
                let ready = self.onDocumentReady
                self.onDocumentReady = nil
                ready?()
            } catch { /* updateHash reports a failure only while the session is still valid. */ }
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard valid, self.webView === webView else { return }
        if (error as NSError).code != NSURLErrorCancelled { needsReload = true; lastFailure = error; onFailure?() }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        guard valid, self.webView === webView else { return }
        if (error as NSError).code != NSURLErrorCancelled { needsReload = true; lastFailure = error; onFailure?() }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        guard valid, self.webView === webView else { return }
        documentFinished = false
        needsReload = true
        lastFailure = NSError(domain: WKErrorDomain, code: WKError.Code.webContentProcessTerminated.rawValue)
        onFailure?()
    }
}

/// Durable cleanup intent only: this preference contains profile UUIDs, never records or cookies.
@MainActor
enum WorkbenchProfiles {
    private static let queueKey = "forma.workbench.pending-profile-deletions.v1"
    private static var draining: Task<Void, Error>?
    private static var cookieWrites: [UUID: Int] = [:]
    private static var bindings: [UUID: (origin: URL, account: String)] = [:]

    static func enqueue(_ id: UUID) {
        guard validIdentifier(id) else { return }
        var pending = queue()
        if !pending.contains(id) { pending.append(id); save(pending) }
    }

    static func drain() async throws {
        if let draining { try await draining.value; return }
        let task = Task { @MainActor in try await drainQueue() }
        draining = task
        do { try await task.value; draining = nil }
        catch { draining = nil; throw error }
    }

    fileprivate static func validIdentifier(_ id: UUID) -> Bool {
        id.uuidString != "00000000-0000-0000-0000-000000000000"
    }

    fileprivate static func claim(_ id: UUID, origin: URL, account: String) throws {
        guard !queue().contains(id) else { throw WorkbenchStorageError.cleanupPending }
        if let binding = bindings[id], binding.origin != origin || binding.account != account { throw NativeAPIError.invalidSession }
        bindings[id] = (origin, account)
    }

    fileprivate static func beginCookieWrite(_ id: UUID) { cookieWrites[id, default: 0] += 1 }
    fileprivate static func endCookieWrite(_ id: UUID) {
        let remaining = (cookieWrites[id] ?? 1) - 1
        if remaining > 0 { cookieWrites[id] = remaining } else { cookieWrites[id] = nil }
    }

    private static func queue() -> [UUID] {
        var seen = Set<UUID>()
        return (UserDefaults.standard.stringArray(forKey: queueKey) ?? []).compactMap(UUID.init(uuidString:))
            .filter { validIdentifier($0) && seen.insert($0).inserted }
    }

    private static func save(_ ids: [UUID]) {
        if ids.isEmpty { UserDefaults.standard.removeObject(forKey: queueKey) }
        else { UserDefaults.standard.set(ids.map(\.uuidString), forKey: queueKey) }
    }

    private static func drainQueue() async throws {
        var handled = Set<UUID>()
        var firstFailure: Error?
        while let id = queue().first(where: { !handled.contains($0) }) {
            handled.insert(id)
            do {
                try await purge(id)
                save(queue().filter { $0 != id })
            } catch {
                // Keep the UUID in durable preferences. Other independent profiles can still clear.
                if firstFailure == nil { firstFailure = error }
            }
        }
        if let firstFailure { throw firstFailure }
    }

    private static func purge(_ id: UUID) async throws {
        let waits: [UInt64] = [150_000_000, 300_000_000, 600_000_000]
        for attempt in 0...waits.count {
            do {
                guard cookieWrites[id] == nil else { throw WorkbenchStorageError.cleanupPending }
                await clearWebsiteData(id)
                try await WKWebsiteDataStore.remove(forIdentifier: id)
                return
            } catch {
                // The caller's production UI maps errors to a generic message. Tests may inspect
                // the original SDK domain/code to distinguish a live profile from disk failure.
                if attempt == waits.count { throw error }
                try await Task.sleep(nanoseconds: waits[attempt])
            }
        }
    }

    private static func clearWebsiteData(_ id: UUID) async {
        // WebKit rejects removal while a data-store object with a network process still exists,
        // even after its last WKWebView was released. Do not retain a local `store` across the
        // subsequent remove(forIdentifier:). The explicit pool also drains Cocoa factory returns.
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            autoreleasepool {
                let store = WKWebsiteDataStore(forIdentifier: id)
                store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) {
                    // Resume after WebKit's callback and its protected data-store reference unwind.
                    DispatchQueue.main.async { continuation.resume() }
                }
            }
        }
    }
}
