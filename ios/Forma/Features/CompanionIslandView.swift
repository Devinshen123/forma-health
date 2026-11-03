import FormaCore
import SwiftUI

/// The website's 3D island, shown in the app's own account-scoped web view.
/// The scene, its models and its simulation live on the service; nothing here
/// redraws them natively, and nothing is shown when the service cannot be reached.
struct CompanionIslandView: View {
    let store: AppStore
    let character: CompanionCharacter
    let level: Int
    @State private var authorized: NativeWorkbenchSession?
    @State private var failed = false

    var body: some View {
        Group {
            if store.isDemo {
                ContentUnavailableView(store.text("登录后进入伙伴乐园", "Sign in to enter the companion island"),
                                       systemImage: "lock",
                                       description: Text(store.text("乐园是网站上的 3D 场景，要连接你的 Forma 账户才能打开。演示不会代替你创建账户。",
                                                                    "The island is a 3D scene on the website and needs your Forma account. The demo never creates an account for you.")))
                    .accessibilityIdentifier("companion.island.demo-gate")
            } else if let authorized {
                AuthorizedWebView(session: authorized, failed: $failed)
                    .id(store.webSessionID)
                    .overlay { if failed { failure } }
                    .ignoresSafeArea(edges: .bottom)
            } else if failed { failure }
            else { ProgressView(store.text("验证账户…", "Verifying account…")) }
        }
        .navigationTitle(store.text("伙伴乐园", "Companion island"))
        .navigationBarTitleDisplayMode(.inline)
        // No identifier on this container: one here collapses the subtree into a single
        // accessibility element and hides the gate and the web view inside it.
        .task(id: store.webSessionID) { await authorize() }
    }

    private var failure: some View {
        ContentUnavailableView {
            Label(store.text("暂时无法打开伙伴乐园", "Island unavailable"), systemImage: "wifi.exclamationmark")
        } description: {
            Text(store.text("请检查网络和服务部署。乐园打不开不影响你的伙伴进度。",
                            "Check your connection and service deployment. Your companion's progress is unaffected."))
        } actions: {
            Button(store.text("重试", "Retry")) { Task { await authorize() } }
                .accessibilityIdentifier("companion.island.retry")
        }
        .background(Color(.systemBackground))
    }

    /// Munchlax has no island model of its own; the website sends Snorlax in its place.
    private var islandDex: Int? {
        guard let dex = companionForm(character, level: level)?.dex else { return nil }
        return dex == 446 ? 143 : dex
    }

    @MainActor private func authorize() async {
        guard !store.isDemo else { return }
        failed = false; authorized = nil
        let generation = store.webSessionID
        guard let api = store.api, let user = store.user, let base = store.baseURL, let dex = islandDex else {
            failed = true; return
        }
        do {
            let me = try await api.json("/api/auth/me")
            guard generation == store.webSessionID, me["user"]["id"].stringValue == user.id,
                  let cookie = api.cookie else { throw NativeAPIError.invalidSession }
            var url = URLComponents(url: base.appendingPathComponent("companion-island/"), resolvingAgainstBaseURL: false)!
            // The same query the website's iframe uses, so one scene serves both.
            url.queryItems = [URLQueryItem(name: "backend", value: "webgl2"),
                              URLQueryItem(name: "companion", value: String(dex)),
                              URLQueryItem(name: "scope", value: user.id)]
            guard let destination = url.url else { throw NativeAPIError.invalidServer }
            let session = try store.prepareWorkbench(account: user.id)
            _ = try await session.attach(url: destination, cookie: cookie)
            guard generation == store.webSessionID else { return }
            authorized = session
        } catch { if generation == store.webSessionID { failed = true } }
    }
}
