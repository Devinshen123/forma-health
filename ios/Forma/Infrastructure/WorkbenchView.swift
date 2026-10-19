import SwiftUI
import WebKit

struct WorkbenchView: View {
    let store: AppStore
    let route: String
    @State private var authorized: AuthorizedWorkbench?
    @State private var failed = false
    var body: some View {
        Group {
            if store.isDemo {
                ContentUnavailableView(store.text("登录后使用完整训练库", "Sign in for the full training library"), systemImage: "lock",
                    description: Text(store.text("动作库、计划、逐组训练和详细统计连接你的 Forma 账户。演示不会代替你创建账户。", "Exercises, plans, set logging and detailed statistics use your Forma account. The demo never creates an account for you.")))
                    .accessibilityIdentifier("workbench.demo-gate")
            } else if let authorized {
                AuthorizedWebView(session: authorized, failed: $failed)
                    .id(store.webSessionID)
                    .overlay { if failed { failure } }
            } else if failed { failure }
            else { ProgressView(store.text("验证账户…", "Verifying account…")) }
        }
        .navigationTitle(store.text("训练工作台", "Training workbench"))
        .navigationBarTitleDisplayMode(.inline)
        .task(id: store.webSessionID) { await authorize() }
        .onDisappear { Task { await store.refresh() } }
    }

    private var failure: some View {
        ContentUnavailableView {
            Label(store.text("暂时无法打开工作台", "Workbench unavailable"), systemImage: "wifi.exclamationmark")
        } description: { Text(store.text("请检查网络和服务部署，个人记录不会用演示替代。", "Check your connection and service deployment. Personal records are never replaced with demo data.")) }
        actions: { Button(store.text("重试", "Retry")) { Task { await authorize() } } }
            .background(Color(.systemBackground))
    }

    @MainActor private func authorize() async {
        guard !store.isDemo else { return }
        failed = false; authorized = nil
        let generation = store.webSessionID
        guard let api = store.api, let user = store.user, let base = store.baseURL else { failed = true; return }
        do {
            let me = try await api.json("/api/auth/me")
            guard generation == store.webSessionID, me["user"]["id"].stringValue == user.id,
                  let cookie = api.cookie else { throw NativeAPIError.invalidSession }
            var url = URLComponents(url: base.appendingPathComponent("training-workbench/"), resolvingAgainstBaseURL: false)!
            url.queryItems = [URLQueryItem(name: "account", value: user.id), URLQueryItem(name: "lang", value: store.language)]
            url.fragment = "/\(["home", "library", "stats"].contains(route) ? route : "home")"
            guard let destination = url.url else { throw NativeAPIError.invalidServer }
            authorized = AuthorizedWorkbench(url: destination, origin: base, cookie: cookie)
        } catch { if generation == store.webSessionID { failed = true } }
    }
}

struct AuthorizedWorkbench {
    let url: URL
    let origin: URL
    let cookie: HTTPCookie
}

private struct AuthorizedWebView: UIViewRepresentable {
    let session: AuthorizedWorkbench
    @Binding var failed: Bool
    func makeCoordinator() -> Coordinator { Coordinator(origin: session.origin, failed: $failed) }
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        let web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.allowsBackForwardNavigationGestures = true
        let coordinator = context.coordinator
        configuration.websiteDataStore.httpCookieStore.setCookie(session.cookie) { [weak web, weak coordinator] in
            guard coordinator?.active == true else { return }
            web?.load(URLRequest(url: session.url))
        }
        return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    static func dismantleUIView(_ web: WKWebView, coordinator: Coordinator) {
        coordinator.active = false
        web.stopLoading(); web.navigationDelegate = nil
        web.loadHTMLString("", baseURL: nil)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let origin: URL
        var active = true
        @Binding var failed: Bool
        init(origin: URL, failed: Binding<Bool>) { self.origin = origin; _failed = failed }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard active, let url = action.request.url, action.targetFrame != nil else { decisionHandler(.cancel); return }
            let sameOrigin = url.scheme == origin.scheme && url.host == origin.host && url.port == origin.port
            // blob URLs are local export/download objects, never a navigation destination.
            let allowed = sameOrigin && !action.shouldPerformDownload
            decisionHandler(allowed ? .allow : .cancel)
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { if active { failed = true } }
        func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                     decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            guard active, let url = response.response.url else { decisionHandler(.cancel); return }
            let sameOrigin = url.scheme == origin.scheme && url.host == origin.host && url.port == origin.port
            let disposition = (response.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition") ?? ""
            decisionHandler(sameOrigin && response.canShowMIMEType && !disposition.lowercased().contains("attachment") ? .allow : .cancel)
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { if active { failed = true } }
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { if active { failed = true } }
    }
}
