import SwiftUI

struct ConnectionView: View {
    let store: AppStore
    @State private var server = UserDefaults.standard.string(forKey: "forma.server") ?? ""
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var registering = false
    @State private var message: String?
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Forma").font(.largeTitle.bold())
                    Text(store.text("把状态，练成习惯。", "Build habits. Find your rhythm."))
                }
                Section(store.text("连接你的 Forma 服务", "Connect to your Forma service")) {
                    TextField("https://your-forma-service.example", text: $server)
                        .textContentType(.URL).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                        .accessibilityIdentifier("connection.server")
                    Text(store.text("填写已部署的 HTTPS 根地址。电脑上的 127.0.0.1 地址不能直接用于 iPhone。", "Use your deployed HTTPS origin. Your computer’s 127.0.0.1 address is not reachable from iPhone."))
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section(store.text("账户", "Account")) {
                    Toggle(store.text("创建新账户", "Create a new account"), isOn: $registering)
                    if registering { TextField(store.text("姓名", "Name"), text: $name).textContentType(.name) }
                    TextField(store.text("邮箱", "Email"), text: $email).keyboardType(.emailAddress)
                        .textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField(store.text("密码", "Password"), text: $password)
                        .textContentType(registering ? .newPassword : .password)
                    if registering { Text(store.text("注册将把你审核确认的记录保存至所连接的服务。", "Registration saves the records you review and confirm to the connected service.")).font(.caption) }
                    Button(store.text(registering ? "创建并登录" : "登录", registering ? "Create account" : "Sign in")) {
                        Task {
                            message = nil
                            do { try await store.signIn(server: server, email: email, password: password, name: name, register: registering); password = "" }
                            catch { message = store.message(error); password = "" }
                        }
                    }.disabled(store.isBusy || server.isEmpty || email.isEmpty || password.isEmpty || (registering && name.isEmpty))
                        .accessibilityIdentifier("connection.sign-in")
                    if store.isBusy { ProgressView() }
                }
                if let message = message ?? store.error { Section { Text(message).foregroundStyle(.red) } }
                Section {
                    Button(store.text("先体验演示", "Explore the demo")) { store.enterDemo() }
                        .accessibilityIdentifier("connection.demo")
                    Text(store.text("演示使用独立样例，不连接或修改你的健康记录。", "The demo uses separate sample data and does not access or modify your health records.")).font(.caption).foregroundStyle(.secondary)
                }
            }.disabled(store.isBusy)
        }
    }
}
