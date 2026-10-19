import SwiftUI

@main
struct FormaApp: App {
    @State private var store = AppStore()
    var body: some Scene {
        WindowGroup {
            RootView(store: store)
                .tint(Color(red: 0.32, green: 0.46, blue: 0.06))
                .task { await store.bootstrap() }
        }
    }
}

struct RootView: View {
    let store: AppStore
    @State private var showSettings = false
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        Group {
            if !store.isReady { ProgressView("Forma") }
            else if store.user == nil && !store.isDemo { ConnectionView(store: store) }
            else { tabs }
        }
        .sheet(isPresented: $showSettings) { SettingsView(store: store) }
        .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await store.refresh() } } }
        .overlay {
            if scenePhase != .active {
                Color(.systemBackground).overlay(Text("Forma").font(.largeTitle.bold())).ignoresSafeArea()
            }
        }
    }

    private var tabs: some View {
        TabView {
            page(store.text("今日", "Today"), symbol: "square.grid.2x2", id: "today") { TodayView(store: store) }
            page(store.text("饮食", "Nutrition"), symbol: "fork.knife", id: "nutrition") { NutritionView(store: store) }
            page(store.text("训练", "Training"), symbol: "dumbbell", id: "training") { TrainingView(store: store) }
            page(store.text("睡眠", "Sleep"), symbol: "moon", id: "sleep") { SleepView(store: store) }
            page(store.text("趋势", "Trends"), symbol: "chart.bar", id: "trends") { TrendsView(store: store) }
        }
    }

    private func page<Content: View>(_ title: String, symbol: String, id: String,
                                     @ViewBuilder content: () -> Content) -> some View {
        NavigationStack {
            content()
                .navigationTitle(title)
                .safeAreaInset(edge: .top, spacing: 0) {
                    if let error = store.error, !store.isDemo {
                        Text(error).font(.caption).foregroundStyle(.red)
                            .frame(maxWidth: .infinity).padding(8).background(Color(.systemBackground))
                            .accessibilityIdentifier("sync.error")
                    }
                    if store.isDemo {
                        Text(store.text("演示数据 · 不会保存到个人账户", "Demo data · never saved to your account"))
                            .font(.caption).frame(maxWidth: .infinity).padding(8)
                            .background(Color(red: 0.77, green: 0.96, blue: 0.40))
                            .accessibilityIdentifier("demo.banner")
                    }
                }
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showSettings = true } label: { Image(systemName: "person.crop.circle") }
                            .accessibilityLabel(store.text("设置", "Settings"))
                            .accessibilityIdentifier("settings.open")
                    }
                }
                .refreshable { await store.refresh() }
        }
        .tabItem { Label(title, systemImage: symbol).accessibilityIdentifier("tab.\(id)") }
    }
}
