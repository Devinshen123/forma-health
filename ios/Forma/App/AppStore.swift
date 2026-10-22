import Foundation
import Observation
import FormaCore

@MainActor @Observable
final class AppStore {
    var state: JSONValue = .object([:])
    var user: FormaUser?
    var isDemo = false
    var isBusy = false
    var isReady = false
    var isPurging = false
    var cleanupFailed = false
    var canRestoreSession = false
    var error: String?
    /// The companion game snapshot. Separate from health facts and from the sync error banner.
    var companion: CompanionSnapshot?
    var companionError: String?
    var companionBusy = false
    var language: String = "zh" {
        didSet { if !uiTesting { UserDefaults.standard.set(language, forKey: "forma.language") } }
    }
    private(set) var baseURL: URL?
    private(set) var webSessionID = UUID()
    private(set) var api: NativeAPI?
    private(set) var workbenchSession: NativeWorkbenchSession?
    private var webProfileID: UUID?
    private var versions: [String: Int] = [:]
    private var generation = UUID()
    private typealias PendingSave = (key: String, value: JSONValue, mutation: JSONValue)
    private var pending: PendingSave?
    private var parkedSave: (server: String, account: String, save: PendingSave)?
    var hasUnconfirmedSave: Bool { pending != nil }
    let uiTesting: Bool

    init(uiTesting: Bool = ProcessInfo.processInfo.arguments.contains("--uitesting")) {
        self.uiTesting = uiTesting
        language = uiTesting ? "zh" : (UserDefaults.standard.string(forKey: "forma.language") ?? "zh")
    }

    func text(_ zh: String, _ en: String) -> String { language == "zh" ? zh : en }
    func records(_ collection: String) -> [JSONValue] { state[collection].arrayValue ?? [] }

    func bootstrap() async {
        guard !isReady else { return }
        if uiTesting { enterDemo(); isReady = true; return }
        await retryLocalCleanup()
        guard !cleanupFailed else { isReady = true; return }
        if let saved = SessionVault.load(), let url = try? NativeAPI.server(saved.server), let cookie = saved.cookie(for: url) {
            let client = NativeAPI(baseURL: url, cookie: cookie)
            baseURL = url; api = client
            let ticket = generation
            do {
                let me = try await client.json("/api/auth/me")
                guard ticket == generation, me["user"]["id"].stringValue == saved.user.id else { throw NativeAPIError.invalidSession }
                user = saved.user
                try await load(client, account: saved.user.id, ticket: ticket)
                restoreParkedSave(server: url, account: saved.user.id)
                webProfileID = saved.webStoreID
                canRestoreSession = false
            } catch {
                guard ticket == generation else { return }
                clearLocal(preservingDrafts: true)
                canRestoreSession = true
                self.error = text("会话暂时无法确认。可联网重试恢复，或登录同一账户；本地训练草稿仍被隔离保留。", "The session could not be verified. Retry online or sign in to the same account; local training drafts remain isolated.")
            }
        }
        isReady = true
    }

    func signIn(server: String, email: String, password: String, name: String, register: Bool) async throws {
        guard !isBusy, !isPurging, !cleanupFailed else { return }
        isBusy = true; defer { isBusy = false }
        let previous = uiTesting ? nil : SessionVault.load()
        clearLocal(preservingDrafts: true)
        let ticket = generation
        let url = try NativeAPI.server(server)
        let client = NativeAPI(baseURL: url)
        api = client; baseURL = url
        do {
            var fields: [String: JSONValue] = ["email": .string(email), "password": .string(password)]
            if register { fields["name"] = .string(name) }
            let result = try await client.json("/api/auth/\(register ? "register" : "login")", method: "POST", body: .object(fields))
            guard ticket == generation, let accountData = try? JSONEncoder().encode(result["user"]) else { throw NativeAPIError.staleSession }
            let account = try JSONDecoder().decode(FormaUser.self, from: accountData)
            guard let cookie = client.cookie, let expiry = cookie.expiresDate, expiry > Date() else { throw NativeAPIError.invalidSession }
            let me = try await client.json("/api/auth/me")
            guard ticket == generation, me["user"]["id"].stringValue == account.id else { throw NativeAPIError.invalidSession }
            try await load(client, account: account.id, ticket: ticket)
            let sameAccount = previous?.server == url.absoluteString && previous?.user.id == account.id
            let profile = sameAccount ? previous!.webStoreID : UUID()
            if !sameAccount, let previous {
                WorkbenchProfiles.enqueue(previous.webStoreID)
                do { try await WorkbenchProfiles.drain() }
                catch { cleanupFailed = true; throw error }
                guard ticket == generation else { throw NativeAPIError.staleSession }
            }
            try SessionVault.save(SavedSession(server: url.absoluteString, user: account, token: cookie.value, expires: expiry, webStoreID: profile))
            UserDefaults.standard.set(url.absoluteString, forKey: "forma.server")
            user = account
            restoreParkedSave(server: url, account: account.id)
            webProfileID = profile
            canRestoreSession = false
            isDemo = false
        } catch {
            if ticket == generation {
                clearLocal(preservingDrafts: true)
                if cleanupFailed { self.error = text("本地训练数据尚未清理完成，请重试后再切换账户。", "Local training data could not be cleared. Retry before switching accounts.") }
            }
            throw error
        }
    }

    private func load(_ client: NativeAPI, account: String, ticket: UUID) async throws {
        let data = try await client.send("/api/sync", account: account)
        let snapshot = try JSONDecoder().decode(SyncSnapshot.self, from: data)
        guard ticket == generation else { throw NativeAPIError.staleSession }
        state = snapshot.state; versions = snapshot.entityVersions; error = nil
        if let pending, let collection = pending.key.split(separator: ":").first,
           records(String(collection)).contains(pending.value) { self.pending = nil }
    }

    func refresh() async {
        guard !isDemo, let api, let user, !isBusy else { return }
        isBusy = true; defer { isBusy = false }
        let ticket = generation
        do { try await load(api, account: user.id, ticket: ticket) }
        catch {
            guard ticket == generation else { return }
            handleSessionFailure(error)
            self.error = message(error)
            return
        }
        if companion != nil { await loadCompanion() }
    }

    func saveRecord(collection: String, value: JSONValue) async throws {
        guard !isDemo, let api, let user, !isBusy,
              ["meals", "sleeps", "workouts"].contains(collection), let id = value["id"].stringValue else {
            throw NativeAPIError.invalidSession
        }
        isBusy = true; defer { isBusy = false }
        let ticket = generation
        let key = "\(collection):\(id)"
        // A confirmed identical retry is already saved; never create another fact.
        if records(collection).contains(where: { $0["id"].stringValue == id && $0 == value }) { return }
        if let pending, pending.key != key || pending.value != value {
            throw NativeAPIError.http(409, "PENDING_SAVE", nil)
        }
        let mutation = pending?.mutation ?? .object([
            "mutationId": .string(UUID().uuidString.lowercased()),
            "changes": .array([.object(["collection": .string(collection), "id": .string(id),
                                       "baseVersion": .number(Double(versions[key] ?? 0)), "kind": .string("upsert"), "value": value])])
        ])
        pending = (key, value, mutation)
        do {
            let data = try await api.send("/api/sync", method: "POST", body: mutation, account: user.id)
            let snapshot = try JSONDecoder().decode(SyncSnapshot.self, from: data)
            guard ticket == generation else { throw NativeAPIError.staleSession }
            state = snapshot.state; versions = snapshot.entityVersions; pending = nil; self.error = nil
        } catch {
            guard ticket == generation else { throw NativeAPIError.staleSession }
            if case let NativeAPIError.http(status, _, _) = error, (400..<500).contains(status), status != 401 { pending = nil }
            handleSessionFailure(error)
            throw error
        }
    }

    func logout() async {
        let client = api; let account = user?.id
        // Lock the UI and invalidate delayed responses before waiting for the server.
        clearLocal(invalidatingClient: false)
        if let client, let account { _ = try? await client.send("/api/auth/logout", method: "POST", body: .object([:]), account: account) }
        client?.invalidate()
    }

    func retryUnconfirmedSave() async throws {
        guard let pending, let collection = pending.key.split(separator: ":").first else { return }
        try await saveRecord(collection: String(collection), value: pending.value)
    }

    func exportData() async throws -> Data {
        guard !isDemo, let api, let user else { throw NativeAPIError.invalidSession }
        let ticket = generation
        let data = try await api.send("/api/export", account: user.id)
        guard ticket == generation else { throw NativeAPIError.staleSession }
        return data
    }

    func deleteAccount(password: String) async throws {
        guard !isDemo, let api, let user else { throw NativeAPIError.invalidSession }
        let ticket = generation
        _ = try await api.send("/api/account", method: "DELETE", body: .object(["password": .string(password)]), account: user.id)
        guard ticket == generation else { throw NativeAPIError.staleSession }
        clearLocal()
    }

    func clearLocal(preservingDrafts: Bool = false, invalidatingClient: Bool = true) {
        let profile = webProfileID ?? (uiTesting ? nil : SessionVault.load()?.webStoreID)
        if preservingDrafts, let pending, let baseURL, let user {
            parkedSave = (baseURL.absoluteString, user.id, pending)
        }
        if !preservingDrafts { parkedSave = nil }
        workbenchSession?.lock(); workbenchSession = nil; webProfileID = nil
        generation = UUID(); if invalidatingClient { api?.invalidate() }; api = nil; baseURL = nil
        user = nil; state = .object([:]); versions = [:]; pending = nil
        companion = nil; companionError = nil; companionBusy = false
        isDemo = false; webSessionID = UUID(); error = nil
        if !uiTesting && !preservingDrafts {
            SessionVault.beginClear(profileID: profile); canRestoreSession = false
            if let profile { WorkbenchProfiles.enqueue(profile) }
            isPurging = true
            Task { await retryLocalCleanup() }
        }
    }

    private func handleSessionFailure(_ error: Error) {
        if case NativeAPIError.http(401, _, _) = error {
            clearLocal(preservingDrafts: true)
            canRestoreSession = !uiTesting && SessionVault.load() != nil
        }
    }

    private func restoreParkedSave(server: URL, account: String) {
        if let parkedSave, parkedSave.server == server.absoluteString, parkedSave.account == account {
            let save = parkedSave.save
            if let collection = save.key.split(separator: ":").first,
               !records(String(collection)).contains(save.value) { pending = save }
        }
        parkedSave = nil
    }

    func message(_ error: Error) -> String {
        switch error {
        case NativeAPIError.invalidServer:
            return text("请填写服务的 HTTPS 根地址，不含路径、密码或查询参数。", "Enter your service’s HTTPS origin without a path, credentials or query.")
        case NativeAPIError.http(401, _, _):
            return text("邮箱、密码或会话无效，请重新登录。", "Email, password or session is invalid. Please sign in again.")
        case NativeAPIError.http(409, _, _):
            return text("记录发生冲突或仍有未确认保存，请刷新核对后重试。", "A record conflicted or a save is still unconfirmed. Refresh and review before retrying.")
        case NativeAPIError.http(400, _, _):
            return text("请检查填写的日期、份量和数值。", "Check the dates, portions and values.")
        case NativeAPIError.http(403, _, _):
            return text("服务未允许此连接，请检查 HTTPS 部署配置。", "The service refused this connection. Check its HTTPS configuration.")
        case NativeAPIError.http(429, _, _):
            return text("操作过于频繁，请稍后再试。", "Too many attempts. Please try again later.")
        default:
            return text("暂时无法确认操作结果。请检查网络；保存重试会沿用同一条记录。", "The result could not be confirmed. Check your connection; retrying uses the same record.")
        }
    }

    func enterDemo() {
        clearLocal(preservingDrafts: true); isDemo = true
        let now = Date()
        var sample: [String: JSONValue] = [:]
        sample["meals"] = .array((try? NativeRecords.meal(name: "Breakfast / 早餐", date: now, grams: 250, kcal: 200, protein: 10, carbs: 20, fat: 5, type: "breakfast")).map { [$0] } ?? [])
        sample["workouts"] = .array((try? NativeRecords.workout(name: "Strength / 力量训练", date: now, duration: 30, exerciseName: "Squat / 深蹲", sets: 3, reps: 8, weight: 40, notes: "")).map { [$0] } ?? [])
        let end = Calendar.current.startOfDay(for: now).addingTimeInterval(7 * 3600)
        sample["sleeps"] = .array((try? NativeRecords.sleep(start: end.addingTimeInterval(-8 * 3600), end: end, quality: 4, energy: 4, timezone: TimeZone.current.identifier)).map { [$0] } ?? [])
        state = .object(sample)
        companion = demoCompanion()
    }

    func leaveDemo() {
        clearLocal(preservingDrafts: true)
        canRestoreSession = !uiTesting && SessionVault.load() != nil
    }

    func retryRestore() async { isReady = false; await bootstrap() }

    func retryLocalCleanup() async {
        guard !uiTesting else { return }
        isPurging = true; cleanupFailed = false
        defer { isPurging = false }
        do {
            if let profile = SessionVault.pendingProfileID { WorkbenchProfiles.enqueue(profile) }
            try SessionVault.clearPendingCredentials()
            try await WorkbenchProfiles.drain()
            SessionVault.completeClear()
            self.error = nil
        }
        catch {
            cleanupFailed = true
            self.error = text("本地训练数据尚未清理完成，请重试后再切换账户。", "Local training data could not be cleared. Retry before switching accounts.")
        }
    }

    // MARK: - Companion

    /// Reads the companion snapshot. Never sends health facts; the service derives rewards itself.
    func loadCompanion() async {
        if isDemo {
            if companion == nil { companion = demoCompanion() }
            return
        }
        await companionRequest("")
    }

    func claimCompanion(rest: Bool = false) async {
        guard !isDemo else {
            companionError = text("演示模式不会把进度保存到真实账户。登录后可领取今天的奖励。",
                                  "Demo mode never saves progress to a real account. Sign in to claim today’s reward.")
            return
        }
        await companionRequest(rest ? "/rest" : "/claim", method: "POST", body: .object([:]))
    }

    func openCompanionChest(id: String) async {
        guard let encoded = Self.companionPathComponent(id) else {
            companionError = text("这个宝箱已不可用，请刷新伙伴页。", "This chest is no longer available. Refresh your companion.")
            return
        }
        if isDemo {
            guard let snapshot = companion,
                  let opened = snapshot.openingChest(id: id) else { return }
            companion = opened
            companionError = nil
            return
        }
        await companionRequest("/chests/\(encoded)/open", method: "POST", body: .object([:]))
    }

    func equipCompanion(_ item: CompanionItem?) async {
        if isDemo {
            guard let snapshot = companion else { return }
            guard let updated = snapshot.replacingEquipped(item) else {
                companionError = text("先打开对应里程碑的宝箱，才能换上这件装扮。",
                                      "Open the matching milestone chest before equipping this item.")
                return
            }
            companion = updated
            companionError = nil
            return
        }
        let value: JSONValue = item.map { .string($0.rawValue) } ?? .null
        await companionRequest("/equipment", method: "PUT", body: .object(["item": value]))
    }

    /// Every character is free; switching never resets XP, the wardrobe or rewards.
    func selectCompanionCharacter(_ character: CompanionCharacter) async {
        if isDemo {
            guard let snapshot = companion else { return }
            companion = snapshot.replacingCharacter(character)
            companionError = nil
            return
        }
        await companionRequest("/character", method: "PUT", body: .object(["character": .string(character.rawValue)]))
    }

    enum CompanionChallengeAction { case create, join(String), leave }

    func companionChallenge(_ action: CompanionChallengeAction) async {
        guard !isDemo else {
            companionError = text("演示模式不能加入双人挑战。", "Demo mode cannot join a shared challenge.")
            return
        }
        var body: JSONValue
        switch action {
        case .create: body = .object(["action": .string("create")])
        case .leave: body = .object(["action": .string("leave")])
        case .join(let raw):
            guard let code = Self.companionChallengeCode(raw) else {
                companionError = text("邀请码是 16 位十六进制字符（0-9、A-F）。",
                                      "An invitation code is 16 hexadecimal characters (0-9, A-F).")
                return
            }
            body = .object(["action": .string("join"), "code": .string(code)])
        }
        await companionRequest("/challenges", method: "POST", body: body)
    }

    /// Normalises an invitation exactly as the service does before its own check.
    static func companionChallengeCode(_ raw: String) -> String? {
        let code = raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        // Exactly the service's /^[0-9A-F]{16}$/; `isHexDigit` would also accept other Unicode digits.
        let hex = Set("0123456789ABCDEF")
        guard code.count == 16, code.allSatisfy(hex.contains) else { return nil }
        return code
    }

    /// Keeps a service-supplied id from reshaping the request path.
    static func companionPathComponent(_ id: String) -> String? {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        guard !id.isEmpty, id.unicodeScalars.allSatisfy(allowed.contains) else { return nil }
        return id
    }

    private func companionRequest(_ path: String, method: String = "GET", body: JSONValue? = nil) async {
        guard !isDemo, !isPurging, !cleanupFailed, let api, let user, !companionBusy else { return }
        companionBusy = true
        defer { companionBusy = false }
        let ticket = generation
        do {
            let data = try await api.send("/api/companion" + path, method: method, body: body, account: user.id)
            let snapshot = try JSONDecoder().decode(CompanionSnapshot.self, from: data)
            guard ticket == generation else { return }
            companion = snapshot
            companionError = nil
        } catch {
            guard ticket == generation else { return }
            handleSessionFailure(error)
            companionError = companionMessage(error)
        }
    }

    func companionMessage(_ error: Error) -> String {
        if case let NativeAPIError.http(_, code, _) = error {
            switch code {
            case "CHEST_NOT_FOUND":
                return text("这个宝箱已不可用，请刷新伙伴页。", "This chest is no longer available. Refresh your companion.")
            case "ITEM_NOT_OWNED":
                return text("先打开对应里程碑的宝箱，才能换上这件装扮。",
                            "Open the matching milestone chest before equipping this item.")
            case "CHALLENGE_ACTIVE":
                return text("先离开当前挑战，再加入新的。", "Leave your current challenge before joining another.")
            case "CHALLENGE_UNAVAILABLE":
                return text("这个邀请码无效或已过期。", "This invitation is unavailable or has expired.")
            case "CHALLENGE_RATE_LIMIT":
                return text("挑战操作过于频繁，请稍后再试。", "Too many challenge requests. Please try again later.")
            default:
                break
            }
        }
        return message(error)
    }

    func prepareWorkbench(account: String) throws -> NativeWorkbenchSession {
        guard account == user?.id, !isDemo, !isPurging, !cleanupFailed,
              let baseURL, let webProfileID else { throw NativeAPIError.invalidSession }
        if let workbenchSession { return workbenchSession }
        let session = try NativeWorkbenchSession(id: webProfileID, origin: baseURL, accountId: account)
        workbenchSession = session
        return session
    }
}
