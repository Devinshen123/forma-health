import SwiftUI
import WebKit

struct WorkbenchView: View {
    let store: AppStore
    let route: String
    @State private var authorized: NativeWorkbenchSession?
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
            let session = try store.prepareWorkbench(account: user.id)
            _ = try await session.attach(url: destination, cookie: cookie)
            guard generation == store.webSessionID else { return }
            authorized = session
        } catch { if generation == store.webSessionID { failed = true } }
    }
}

private struct AuthorizedWebView: UIViewRepresentable {
    let session: NativeWorkbenchSession
    @Binding var failed: Bool
    func makeCoordinator() -> NativeWorkbenchSession { session }
    func makeUIView(context: Context) -> WKWebView {
        session.onFailure = { failed = true }
        if let web = session.webView { return web }
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        return WKWebView(frame: .zero, configuration: config)
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {
        if session.webView != nil { session.onFailure = { failed = true } }
    }
    static func dismantleUIView(_ web: WKWebView, coordinator: NativeWorkbenchSession) {
        // The account owns this page and its pending writes; closing the sheet only detaches it.
        // Logout/account change explicitly locks and purges it through AppStore.
        coordinator.detach()
    }
}
