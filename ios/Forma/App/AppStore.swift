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
    var planError: String?
    var reportError: String?
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
    /// A plan write spans several collections at once, so its unconfirmed state is tracked apart
    /// from the single-record slot. Retrying reuses the same mutation id and adds no second version.
    private var pendingPlan: (key: String, mutation: JSONValue, confirm: (JSONValue) -> Bool)?
    var hasUnconfirmedPlanSave: Bool { pendingPlan != nil }
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
        if let pendingPlan, pendingPlan.confirm(state) { self.pendingPlan = nil }
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
              ["meals", "sleeps", "workouts", "reports"].contains(collection), let id = value["id"].stringValue else {
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
        pendingPlan = nil; planError = nil; reportError = nil
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
        // The same starting plan the website's demo shows: both nutrition targets stay unset,
        // so the page has to render them as missing rather than zero.
        let planId = "demo-plan-1"
        sample["planVersions"] = .array([.object([
            "id": .string(planId), "parentId": .null, "createdAt": .string(wireInstant(now)),
            "reason": .string("onboarding.initial"),
            "trainingMinutes": .number(45), "trainingDays": .number(3), "sleepHours": .number(8),
            "calorieTarget": .null, "proteinTarget": .null,
        ])])
        sample["currentPlanId"] = .string(planId)
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

    // MARK: - Reports

    var reports: [ReportView] { ReportState.reports(state) }

    /// Loads an attachment's bytes for display. Returns nil rather than a placeholder when the
    /// service has no such attachment, so a missing document is never shown as an empty one.
    func attachmentData(_ assetId: String) async -> Data? {
        guard !isDemo, let api, let user, UUID(uuidString: assetId) != nil else { return nil }
        let ticket = generation
        do {
            let data = try await api.send("/api/assets/\(assetId)", account: user.id)
            guard ticket == generation else { return nil }
            return data
        } catch {
            guard ticket == generation else { return nil }
            handleSessionFailure(error)
            reportError = reportMessage(error)
            return nil
        }
    }

    func saveReport(_ report: JSONValue) async {
        guard !isDemo else {
            reportError = text("演示模式不会把报告保存到真实账户。", "Demo mode never saves a report to a real account.")
            return
        }
        do {
            try await saveRecord(collection: "reports", value: report)
            reportError = nil
        } catch {
            reportError = reportMessage(error)
        }
    }

    /// Removing an attachment is two steps in a fixed order: the record stops pointing at it,
    /// then the attachment itself is deleted. The service refuses to delete one still referenced,
    /// so a failure after the first step leaves a report without its attachment but never a
    /// dangling reference.
    func removeAttachment(from report: ReportView) async {
        guard !isDemo else {
            reportError = text("演示模式不会改动真实账户的附件。", "Demo mode never changes a real account's attachments.")
            return
        }
        guard let assetId = report.assetId, let api, let user else { return }
        let updated: JSONValue
        do { updated = try NativeReports.removingAttachment(from: report) }
        catch { reportError = reportMessage(error); return }

        do { try await saveRecord(collection: "reports", value: updated) }
        catch { reportError = reportMessage(error); return }

        let ticket = generation
        do {
            _ = try await api.send("/api/assets/\(assetId)", method: "DELETE",
                                   body: .object([:]), account: user.id)
            guard ticket == generation else { return }
            reportError = nil
        } catch {
            guard ticket == generation else { return }
            handleSessionFailure(error)
            reportError = text("报告已不再引用该附件，但删除附件本身没有成功，可以重试。",
                               "The report no longer references the attachment, but deleting the attachment itself did not succeed. You can retry.")
        }
    }

    /// Deletes an attachment no record points at any more, for retrying a half-finished removal.
    func deleteOrphanAttachment(_ assetId: String) async {
        guard !isDemo, UUID(uuidString: assetId) != nil else { return }
        // The reason is a local fact, so it is explained before anything about the session.
        guard !ReportState.attachmentIsReferenced(state, assetId: assetId) else {
            reportError = text("请先把该附件从报告中移除，再删除附件。",
                               "Remove this attachment from its report before deleting it.")
            return
        }
        guard let api, let user else { return }
        let ticket = generation
        do {
            _ = try await api.send("/api/assets/\(assetId)", method: "DELETE",
                                   body: .object([:]), account: user.id)
            guard ticket == generation else { return }
            reportError = nil
        } catch {
            guard ticket == generation else { return }
            handleSessionFailure(error)
            reportError = reportMessage(error)
        }
    }

    func reportMessage(_ error: Error) -> String {
        switch error {
        case let error as ReportError:
            switch error {
            case .invalidName:
                return text("请填写报告名称（1–160 个字符）。", "Enter a report name of 1 to 160 characters.")
            case .invalidDate:
                return text("请选择有效的报告日期。", "Choose a valid report date.")
            case .invalidMarkerName:
                return text("每个指标都要有名称（1–160 个字符）。", "Every marker needs a name of 1 to 160 characters.")
            case .invalidMarkerValue:
                return text("每个指标都要填原始数值（最多 500 个字符）；请照抄你的报告，不要换算。",
                            "Every marker needs the original value from your document, up to 500 characters. Copy it as printed; do not convert it.")
            case .markerFieldTooLong:
                return text("某个指标的单位、参考范围或备注过长。", "A marker's unit, range or notes is too long.")
            case .tooManyMarkers:
                return text("一份报告最多 200 个指标。", "A report holds at most 200 markers.")
            case .emptyReport:
                return text("一份报告至少需要一个你手填的指标。这份报告只有原件附件，所以不能在手机上移除它；请先补一个指标。",
                            "A report needs at least one marker you typed yourself. This one holds only its attachment, so it cannot be removed here; add a marker first.")
            case .invalidAttachment:
                return text("这个附件引用无效。", "This attachment reference is not valid.")
            }
        case NativeAPIError.http(409, _, _):
            return text("这条报告已在别处变化。请刷新核对后再保存。",
                        "This report changed elsewhere. Refresh and review before saving.")
        case NativeAPIError.http(404, _, _):
            return text("找不到这个附件，可能已被删除。", "This attachment could not be found; it may already be deleted.")
        case NativeAPIError.http(413, _, _):
            return text("附件必须不超过 10 MB。", "Attachments must be 10 MB or smaller.")
        default:
            return message(error)
        }
    }

    // MARK: - Plan

    /// The only collections a plan write may touch. A document outside this set is refused here,
    /// before anything is sent, so this path can never become a general state editor.
    static let planCollections: Set<String> = ["planVersions", "currentPlanId", "suggestions", "profile"]

    var currentPlan: PlanVersionView? { PlanState.currentPlan(state) }
    var planVersions: [PlanVersionView] { PlanState.versions(state) }
    var proposedSuggestions: [SuggestionView] { PlanState.proposed(state) }
    var undoableSuggestion: SuggestionView? { PlanState.undoableSuggestion(state) }

    func editPlan(_ fields: PlanFields) async {
        guard let plan = currentPlan else { return }
        await applyPlan(key: "edit") { [state] newId in
            try PlanOperations.edit(state: state, fields: fields, baseVersionId: plan.id, newId: newId)
        }
    }

    func acceptSuggestion(_ id: String) async {
        await applyPlan(key: "accept:\(id)") { [state] newId in
            try PlanOperations.accept(state: state, suggestionId: id, newId: newId)
        }
    }

    func rejectSuggestion(_ id: String) async {
        await applyPlan(key: "reject:\(id)") { [state] _ in
            try PlanOperations.reject(state: state, suggestionId: id)
        }
    }

    func undoSuggestion() async {
        await applyPlan(key: "undo") { [state] newId in
            try PlanOperations.undo(state: state, newId: newId)
        }
    }

    /// Builds one atomic mutation for the whole set of documents. Every change carries its own
    /// baseVersion, so a plan the service has moved on from returns 409 for the user to review
    /// rather than being overwritten.
    private func applyPlan(key: String, build: (String) throws -> [PlanDocument]) async {
        guard !isDemo else {
            planError = text("演示模式不会把计划保存到真实账户。", "Demo mode never saves a plan to a real account.")
            return
        }
        guard let api, let user, !isBusy, !isPurging, !cleanupFailed else { return }
        isBusy = true
        defer { isBusy = false }

        let mutation: JSONValue
        let confirm: (JSONValue) -> Bool
        if let pendingPlan, pendingPlan.key == key {
            // The exact same action, retried: reuse the mutation so the service deduplicates it.
            mutation = pendingPlan.mutation
            confirm = pendingPlan.confirm
        } else if pendingPlan != nil {
            planError = text("上一次计划保存还没有确认。请先重试或刷新核对，再做新的调整。",
                             "The previous plan save is not confirmed yet. Retry or refresh before making another change.")
            return
        } else {
            let newId = UUID().uuidString.lowercased()
            let documents: [PlanDocument]
            do { documents = try build(newId) }
            catch { planError = planMessage(error); return }
            guard !documents.isEmpty else { planError = planMessage(PlanError.noChanges); return }
            guard documents.allSatisfy({ Self.planCollections.contains($0.collection) }) else {
                planError = planMessage(PlanError.planChangedElsewhere)
                return
            }
            mutation = Self.planMutation(documents: documents, versions: versions,
                                         mutationId: UUID().uuidString.lowercased())
            confirm = Self.planConfirmation(documents)
        }

        pendingPlan = (key, mutation, confirm)
        let ticket = generation
        do {
            let data = try await api.send("/api/sync", method: "POST", body: mutation, account: user.id)
            let snapshot = try JSONDecoder().decode(SyncSnapshot.self, from: data)
            guard ticket == generation else { return }
            state = snapshot.state
            versions = snapshot.entityVersions
            pendingPlan = nil
            planError = nil
            error = nil
        } catch {
            guard ticket == generation else { return }
            // A refusal the service has already decided on leaves nothing unconfirmed.
            if case let NativeAPIError.http(status, _, _) = error, (400..<500).contains(status), status != 401 {
                pendingPlan = nil
            }
            handleSessionFailure(error)
            planError = planMessage(error)
        }
    }

    /// One atomic mutation for the whole set. Each change carries the baseVersion this client last
    /// saw for that entity, so a plan the service has moved on from comes back as 409 instead of
    /// being overwritten. A document this client has never seen starts at 0, which the service
    /// treats as "must not exist yet".
    static func planMutation(documents: [PlanDocument], versions: [String: Int],
                             mutationId: String) -> JSONValue {
        .object([
            "mutationId": .string(mutationId),
            "changes": .array(documents.map { document -> JSONValue in
                .object([
                    "collection": .string(document.collection),
                    "id": .string(document.id),
                    "baseVersion": .number(Double(versions["\(document.collection):\(document.id)"] ?? 0)),
                    "kind": .string("upsert"),
                    "value": document.value,
                ])
            }),
        ])
    }

    /// Whether a later snapshot already contains this write, so an unconfirmed retry can stop.
    private static func planConfirmation(_ documents: [PlanDocument]) -> (JSONValue) -> Bool {
        let expected = documents
            .filter { $0.collection != "profile" }
            .map { ($0.collection, $0.id, $0.value) }
        return { state in
            expected.allSatisfy { collection, id, value in
                if collection == "currentPlanId" { return state[collection] == value }
                return (state[collection].arrayValue ?? []).contains { $0["id"].stringValue == id && $0 == value }
            }
        }
    }

    func retryUnconfirmedPlanSave() async {
        guard let pendingPlan else { return }
        await applyPlan(key: pendingPlan.key) { _ in [] }
    }

    func planMessage(_ error: Error) -> String {
        switch error {
        case PlanError.missingCurrentPlan:
            return text("还没有计划可以调整。先完成引导，生成第一版计划。",
                        "There is no plan to adjust yet. Finish onboarding to create the first version.")
        case PlanError.planChangedElsewhere:
            return text("计划已在别处更新。请刷新核对最新版本，再确认这次调整。",
                        "The plan changed elsewhere. Refresh and review the latest version before confirming.")
        case PlanError.invalidValues:
            return text("请填写有效值：训练 1–7 天、10–180 分钟，睡眠 4–12 小时；能量 500–8000 kcal，蛋白质 1–400 g。",
                        "Enter valid values: training 1–7 days and 10–180 minutes, sleep 4–12 hours; energy 500–8000 kcal, protein 1–400 g.")
        case PlanError.noChanges:
            return text("没有需要保存的变化。", "There is nothing to save.")
        case PlanError.suggestionUnavailable:
            return text("这条建议已经处理过或不再可用，请刷新查看。",
                        "This suggestion has already been handled or is no longer available. Refresh to see it.")
        case PlanError.missingBaseVersion:
            return text("找不到可恢复的上一版计划，所以无法撤销。历史记录没有被改动。",
                        "The version to restore is missing, so this cannot be undone. No history was changed.")
        case NativeAPIError.http(409, _, _):
            return text("计划已在别处更新。请刷新核对后再确认，本次没有保存。",
                        "The plan changed elsewhere. Refresh and review before confirming; nothing was saved.")
        default:
            return message(error)
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
