import SwiftUI
import UniformTypeIdentifiers

struct ExportDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}

struct SettingsView: View {
    @Bindable var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var export: ExportDocument?
    @State private var exporting = false
    @State private var deleting = false
    @State private var password = ""
    @State private var busy = false
    @State private var message: String?
    @State private var confirmLogout = false
    var body: some View {
        NavigationStack {
            Form {
                Section(store.text("语言", "Language")) {
                    Picker(store.text("语言", "Language"), selection: $store.language) {
                        Text("简体中文").tag("zh").accessibilityIdentifier("settings.language.zh")
                        Text("English").tag("en").accessibilityIdentifier("settings.language.en")
                    }.pickerStyle(.segmented).accessibilityIdentifier("settings.language")
                }
                Section(store.text("账户", "Account")) {
                    Text(store.isDemo ? store.text("演示数据", "Demo data") : (store.user?.email ?? "—"))
                    if let url = store.baseURL { Text(url.absoluteString).font(.caption).textSelection(.enabled) }
                    Button(store.text("刷新记录", "Refresh records")) { Task { await store.refresh() } }.disabled(store.isDemo)
                    if store.hasUnconfirmedSave {
                        Button(store.text("重试未确认的保存", "Retry unconfirmed save")) {
                            Task {
                                busy = true; defer { busy = false }
                                do { try await store.retryUnconfirmedSave(); message = nil }
                                catch { message = store.message(error) }
                            }
                        }
                        Text(store.text("沿用原始记录与请求编号核对保存结果，不会新建重复记录。", "Checks the original record and request identity without creating a duplicate."))
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Button(store.text("导出我的数据", "Export my data")) {
                        Task {
                            busy = true; defer { busy = false }
                            do { export = ExportDocument(data: try await store.exportData()); exporting = true }
                            catch { message = store.message(error) }
                        }
                    }.disabled(store.isDemo)
                    Text(store.text("导出包含服务端记录及附件清单，附件原文件须另行下载。导出文件含私人信息，请选择安全位置。", "The export includes server records and an attachment manifest; original attachment files must be downloaded separately. Choose a private location for this sensitive file."))
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section(store.text("连接状态", "Connections")) {
                    NavigationLink(store.text("Apple Health：只读预览与上传", "Apple Health: read-only preview and upload")) {
                        AppleHealthView(store: store, importer: store.appleHealth)
                    }.disabled(store.isDemo).accessibilityIdentifier("settings.health")
                    LabeledContent(store.text("Apple 登录", "Sign in with Apple"), value: store.text("尚未接入", "Not connected"))
                    Text(store.text("健康数据需要在iPhone中先授权读取，再审核并单独同意上传。不会自动改写手动睡眠或训练记录。", "Health data requires iPhone read permission, then review and separate upload consent. Manual sleep and training records are not overwritten."))
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section {
                    Button(store.text(store.isDemo ? "退出演示" : "退出登录", store.isDemo ? "Leave demo" : "Sign out")) {
                        if store.isDemo { store.leaveDemo(); dismiss() }
                        else { confirmLogout = true }
                    }
                    if !store.isDemo { Button(store.text("删除账户", "Delete account"), role: .destructive) { deleting = true } }
                }
                if let message { Section { Text(message).foregroundStyle(.red) } }
            }
            .disabled(busy)
            .navigationTitle(store.text("设置", "Settings"))
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button(store.text("完成", "Done")) { dismiss() }.accessibilityIdentifier("settings.done") } }
            .fileExporter(isPresented: $exporting, document: export, contentType: .json, defaultFilename: "forma-export") { result in
                if case .failure = result { message = store.text("导出未保存，请重试。", "The export was not saved. Please try again.") }
                export = nil
            }
            .confirmationDialog(store.text("退出将移除本机训练草稿和未同步媒体，已保存的服务端记录会保留。", "Signing out removes local training drafts and unsynced media. Saved server records are retained."), isPresented: $confirmLogout, titleVisibility: .visible) {
                Button(store.text("退出并清理本机数据", "Sign out and clear local data"), role: .destructive) { dismiss(); Task { await store.logout() } }
                Button(store.text("取消", "Cancel"), role: .cancel) {}
            }
            .sheet(isPresented: $deleting) {
                NavigationStack {
                    Form {
                        Text(store.text("将永久删除这个账户及其服务端记录和私有附件。此操作无法撤销。", "This permanently deletes this account, its server records and private attachments. This cannot be undone."))
                        SecureField(store.text("输入密码确认", "Confirm your password"), text: $password)
                        Button(store.text("永久删除账户", "Permanently delete account"), role: .destructive) {
                            Task {
                                busy = true; defer { busy = false }
                                do { try await store.deleteAccount(password: password); password = ""; deleting = false; dismiss() }
                                catch { message = store.message(error); password = ""; deleting = false }
                            }
                        }.disabled(password.isEmpty || busy)
                    }.navigationTitle(store.text("删除账户", "Delete account"))
                        .toolbar { ToolbarItem(placement: .cancellationAction) { Button(store.text("取消", "Cancel")) { password = ""; deleting = false } } }
                }.interactiveDismissDisabled(busy)
            }
        }
    }
}
