import Foundation
import Observation
import HealthKit
import FormaCore

struct HealthPreviewPage: Identifiable {
    let id: String
    let records: [HealthImportRecord]
    let deletedIDs: [String]
    let checkpoint: HealthAnchorCheckpoint
    let mayHaveMore: Bool
}

/// Foreground, user-initiated reads only. Upload consent is separate from HealthKit permission.
@MainActor @Observable
final class AppleHealthImporter {
    private(set) var pages: [HealthPreviewPage] = []
    private(set) var failedTypes: [String] = []
    private(set) var isBusy = false
    private(set) var message: String?
    var uploadConsent = false
    private var healthStore: HKHealthStore?
    private var session: HealthImportSession?
    private var expectedRevision: Int?
    private var runID = UUID()
    @ObservationIgnored private var operation: Task<Void, Never>?

    static var available: Bool { HKHealthStore.isHealthDataAvailable() }
    static let typeIDs = [HKQuantityTypeIdentifier.stepCount.rawValue,
                          HKQuantityTypeIdentifier.activeEnergyBurned.rawValue,
                          HKQuantityTypeIdentifier.heartRate.rawValue,
                          HKQuantityTypeIdentifier.restingHeartRate.rawValue,
                          HKQuantityTypeIdentifier.heartRateVariabilitySDNN.rawValue,
                          HKCategoryTypeIdentifier.sleepAnalysis.rawValue, HKObjectType.workoutType().identifier]
    private static var sampleTypes: [HKSampleType] {
        [HKQuantityType(.stepCount), HKQuantityType(.activeEnergyBurned), HKQuantityType(.heartRate),
         HKQuantityType(.restingHeartRate), HKQuantityType(.heartRateVariabilitySDNN),
         HKCategoryType(.sleepAnalysis), HKObjectType.workoutType()]
    }
    var records: [HealthImportRecord] { pages.flatMap(\.records) }
    var deletionCount: Int { pages.reduce(0) { $0 + $1.deletedIDs.count } }
    var mayHaveMore: Bool { pages.contains(where: \.mayHaveMore) }
    var canUpload: Bool { !isBusy && uploadConsent && !pages.isEmpty && (!records.isEmpty || deletionCount > 0) }

    func invalidate() {
        runID = UUID(); operation?.cancel(); operation = nil; isBusy = false
        pages = []; failedTypes = []; session = nil; expectedRevision = nil; uploadConsent = false; message = nil
    }

    func preview(using app: AppStore) {
        guard !isBusy, !app.uiTesting else { return }
        invalidate()
        guard Self.available else {
            message = app.text("此设备无法读取 Apple Health。", "Apple Health is unavailable on this device."); return
        }
        let context: HealthImportSession
        do { context = try app.healthImportSession() }
        catch { message = app.message(error); return }
        session = context
        let ticket = runID
        isBusy = true
        operation = Task {
            defer { if ticket == runID { isBusy = false; operation = nil } }
            do {
                // Pin the server revision once for the entire preview, including every upload chunk.
                let revision = try await app.appleHealthRevision(session: context)
                try check(app, context, ticket)
                expectedRevision = revision
                let health = healthStore ?? HKHealthStore(); healthStore = health
                let types = Self.sampleTypes
                try await health.requestAuthorization(toShare: [], read: Set(types.map { $0 as HKObjectType }))
                try check(app, context, ticket)
                for type in types {
                    do {
                        let page = try await read(type: type, health: health, namespace: context.namespace)
                        try check(app, context, ticket)
                        pages.append(page)
                    } catch {
                        try check(app, context, ticket)
                        failedTypes.append(type.identifier)
                    }
                }
                message = records.isEmpty && deletionCount == 0
                    ? app.text("没有读到可上传的变化。可能无数据、权限未允许、历史访问受限，或已同步；不能据此判断你拒绝了读取。", "No uploadable changes were read. Data may be absent, not permitted, history-limited or already synced; this does not prove read permission was denied.")
                    : app.text("仅在本机预览，尚未上传。逐类最多200条变化；核对后单独同意上传。", "Local preview only; nothing uploaded. Up to 200 changes per type. Review before separately agreeing to upload.")
            } catch {
                guard ticket == runID else { return }
                pages = []; session = nil; uploadConsent = false
                message = app.isCurrentHealthImport(context)
                    ? app.text("无法完成健康数据读取。请确认设备已解锁、HealthKit能力和系统权限后重试。", "Could not read Health data. Unlock the device and check HealthKit capability and system permissions before retrying.")
                    : app.text("账户或服务器已变化，请重新读取。", "Your account or server changed. Read a new preview.")
            }
        }
    }

    func upload(using app: AppStore) {
        guard canUpload, let context = session, let expectedRevision else { return }
        let ticket = runID
        isBusy = true
        operation = Task {
            var acknowledged = 0
            defer { if ticket == runID { isBusy = false; operation = nil; uploadConsent = false } }
            do {
                try check(app, context, ticket)
                // Keep a page until every request and cursor write succeeds; partial success is replay-safe.
                while let page = pages.first {
                    for payload in HealthImportBatch.payloads(records: page.records, deletedIDs: page.deletedIDs,
                                                              expectedRevision: expectedRevision) {
                        try check(app, context, ticket)
                        try await app.uploadAppleHealth(payload, session: context)
                        try check(app, context, ticket)
                        acknowledged += (payload["records"].arrayValue?.count ?? 0)
                            + (payload["deletedIds"].arrayValue?.count ?? 0)
                    }
                    try HealthAnchorVault.save(page.checkpoint, namespace: context.namespace, type: page.id)
                    pages.removeFirst()
                }
                message = app.text("已确认上传 \(acknowledged) 条样本或删除变化。可重新读取下一批；数据保留原始来源，不自动合并成饮食、训练或睡眠事实。", "Acknowledged \(acknowledged) samples or deletion changes. Read again for the next batch. Sources are preserved; imports do not automatically become meal, workout or sleep facts.")
                session = nil
            } catch {
                guard ticket == runID else { return }
                guard app.isCurrentHealthImport(context) else { invalidate(); return }
                if case NativeAPIError.http(409, _, _) = error {
                    pages = []; session = nil; self.expectedRevision = nil
                    message = app.text("连接已在其他页面断开、删除或更改。本批预览已失效；请重新读取并审核，不会自动沿用新授权。", "The connection was disconnected, deleted or changed elsewhere. This preview expired. Read and review again; authorization is not renewed automatically.")
                    return
                }
                message = app.text("本轮已确认 \(acknowledged) 条，剩余批次未确认。重新勾选同意后可安全重试；使用相同来源UUID，不重复新增。", "Acknowledged \(acknowledged) changes; remaining batches are unconfirmed. Agree again to safely retry with the same source UUIDs.")
            }
        }
    }

    func resetCursors(using app: AppStore) {
        guard !isBusy, let context = try? app.healthImportSession() else { return }
        invalidate()
        do {
            try HealthAnchorVault.reset(namespace: context.namespace, types: Self.typeIDs)
            message = app.text("已重置此服务器和账户的本机游标；再次读取将从最近7天开始。服务端历史保留。", "Local cursors for this server and account were reset. Read again to start from the last 7 days. Server history is retained.")
        } catch { message = app.text("本机游标重置失败，请解锁设备后重试。", "Could not reset local cursors. Unlock the device and retry.") }
    }

    private func check(_ app: AppStore, _ context: HealthImportSession, _ ticket: UUID) throws {
        try Task.checkCancellation()
        guard runID == ticket, app.isCurrentHealthImport(context) else { throw NativeAPIError.staleSession }
    }

    private func read(type: HKSampleType, health: HKHealthStore, namespace: String) async throws -> HealthPreviewPage {
        let previous = try HealthAnchorVault.load(namespace: namespace, type: type.identifier)
        let start = previous?.start ?? Date().addingTimeInterval(-7 * 24 * 3600)
        let anchor: HKQueryAnchor?
        if let previous {
            guard let restored = try NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: previous.anchor) else {
                throw NativeAPIError.malformedResponse
            }
            anchor = restored
        } else { anchor = nil }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: nil, options: .strictStartDate)
        let descriptor = HKAnchoredObjectQueryDescriptor<HKSample>(
            predicates: [.sample(type: type, predicate: predicate)], anchor: anchor, limit: 200)
        let result = try await descriptor.result(for: health)
        let records = try result.addedSamples.map(HealthSampleMapper.record)
        let deletions = result.deletedObjects.map { $0.uuid.uuidString.lowercased() }
        let data = try NSKeyedArchiver.archivedData(withRootObject: result.newAnchor, requiringSecureCoding: true)
        return HealthPreviewPage(id: type.identifier, records: records, deletedIDs: deletions,
                                 checkpoint: HealthAnchorCheckpoint(start: start, anchor: data),
                                 mayHaveMore: records.count + deletions.count >= 200)
    }
}
