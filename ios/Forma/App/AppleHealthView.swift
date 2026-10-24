import SwiftUI
import FormaCore

struct AppleHealthView: View {
    @Bindable var store: AppStore
    @Bindable var importer: AppleHealthImporter
    @State private var confirmReset = false

    var body: some View {
        Form {
            Section(store.text("Apple Health 与 Apple Watch", "Apple Health and Apple Watch")) {
                Text(store.text("只读导入步数、活动能量、心率、静息心率、HRV（SDNN）、睡眠阶段和训练。Apple Watch 数据先进入 Apple Health。本功能不会写入或删除健康 App 的数据。", "Read steps, active energy, heart rate, resting heart rate, HRV (SDNN), sleep stages and workouts. Apple Watch data comes through Apple Health. This feature never writes to or deletes data from the Health app."))
                if let email = store.user?.email { LabeledContent(store.text("上传账户", "Upload account"), value: email) }
                if let server = store.baseURL {
                    Text(server.absoluteString).font(.caption).textSelection(.enabled)
                }
                Text(store.text("首次读取最近7天，每类每批最多200条变化；之后按原窗口游标读取新增和删除，需要手动继续读取下一批。空结果可能是无数据、未允许读取、访问历史受限或已同步。", "The initial window starts 7 days ago, up to 200 changes per type per preview. Later reads track additions and deletions using that fixed window's cursor. Read again for another batch. Empty results may mean no data, no read access, limited history or already synced data."))
                    .font(.caption).foregroundStyle(.secondary)
                if !AppleHealthImporter.available {
                    Text(store.text("此设备无法使用 HealthKit。", "HealthKit is unavailable on this device."))
                }
                Button(store.text("授权读取并在本机预览", "Request read access and preview locally")) { importer.preview(using: store) }
                    .disabled(!AppleHealthImporter.available || importer.isBusy || store.isDemo || store.uiTesting)
                    .accessibilityIdentifier("health.preview")
                if importer.isBusy {
                    ProgressView(store.text("正在处理，请稍候", "Working, please wait"))
                }
                if let message = importer.message { Text(message).accessibilityIdentifier("health.message") }
                if !importer.failedTypes.isEmpty {
                    Text(store.text("部分类型未读完，不会前进这些类型的游标：", "Some types could not be read; their cursors will not advance:")
                         + " " + importer.failedTypes.map(typeLabel).joined(separator: ", "))
                        .foregroundStyle(.secondary)
                }
            }
            ForEach(importer.pages) { page in
                Section(typeLabel(page.id)) {
                    if page.records.isEmpty && page.deletedIDs.isEmpty {
                        Text(store.text("本批无变化（不表示已获读取授权）", "No changes in this batch (does not establish read authorization)"))
                            .foregroundStyle(.secondary)
                    }
                    ForEach(page.records) { record in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(valueLabel(record)).font(.headline)
                            Text(record.startTime + " → " + record.endTime).font(.caption)
                            Text(record.sourceName + " · " + record.sourceID).font(.caption).foregroundStyle(.secondary)
                            if let stage = record.metadata["sleepStage"]?.stringValue {
                                Text(store.text("睡眠阶段：", "Sleep stage: ") + stage).font(.caption)
                            }
                            if let product = record.metadata["productType"]?.stringValue {
                                Text(product).font(.caption).foregroundStyle(.secondary)
                            }
                        }.accessibilityElement(children: .combine)
                    }
                    if !page.deletedIDs.isEmpty {
                        DisclosureGroup(store.text("同步删除 \(page.deletedIDs.count) 条已导入记录", "Remove \(page.deletedIDs.count) deleted imports")) {
                            ForEach(page.deletedIDs, id: \.self) { id in Text(id).font(.caption).textSelection(.enabled) }
                        }
                    }
                    if page.mayHaveMore {
                        Text(store.text("达到本批上限，上传后请再次读取。", "Batch limit reached. Read again after uploading."))
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            if !importer.records.isEmpty || importer.deletionCount > 0 {
                Section(store.text("审核并上传", "Review and upload")) {
                    Text(store.text("本批包含 \(importer.records.count) 条样本和 \(importer.deletionCount) 条删除。重叠步数、能量、睡眠阶段与不同设备来源不会自动相加；HRV SDNN也不会混为RMSSD。", "This preview contains \(importer.records.count) samples and \(importer.deletionCount) deletions. Overlapping steps, energy and sleep stages from different sources are not added together; HRV SDNN is kept separate from RMSSD."))
                    Toggle(store.text("我已核对，同意上传这些样本并同步删除到上方Forma账户和服务器。", "I reviewed and agree to upload these samples and apply deletions to the Forma account and server above."), isOn: $importer.uploadConsent)
                        .disabled(importer.isBusy).accessibilityIdentifier("health.consent")
                    Button(store.text("确认上传本批", "Confirm upload of this preview")) { importer.upload(using: store) }
                        .disabled(!importer.canUpload).accessibilityIdentifier("health.upload")
                    Button(store.text("取消并清除预览", "Cancel and clear preview"), role: .cancel) { importer.invalidate() }
                        .disabled(importer.isBusy)
                    Text(store.text("只在逐批服务端确认后保存游标。网络中断时可重新同意后重试；已经到达服务器的请求无法由关闭页面撤回。", "Cursors are saved only after server acknowledgement of each batch. Agree again to retry after network failure. Closing this page cannot undo requests already received by the server."))
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            Section {
                Button(store.text("重置游标，重新读取最近7天", "Reset cursors to read the last 7 days again")) { confirmReset = true }
                    .disabled(importer.isBusy || store.isDemo || store.uiTesting)
                Text(store.text("只重置本机此服务器与账户的读取游标，不删除已导入记录。若你在网站删除了历史后需要重新导入，可用此操作。关闭此页面会清除未上传预览。", "Resets only local read cursors for this server and account. Imported history is retained. Use this to reimport after deleting records on the website. Leaving this page clears any unsent preview."))
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .navigationTitle(store.text("Apple Health", "Apple Health"))
        .onDisappear { importer.invalidate() }
        .onChange(of: store.webSessionID) { importer.invalidate() }
        .confirmationDialog(store.text("重置只影响本机游标，服务端历史保持。", "Reset affects local cursors only. Server history is retained."), isPresented: $confirmReset, titleVisibility: .visible) {
            Button(store.text("重置游标", "Reset cursors")) { importer.resetCursors(using: store) }
            Button(store.text("取消", "Cancel"), role: .cancel) {}
        }
    }

    private func valueLabel(_ record: HealthImportRecord) -> String {
        (record.value.map { $0.formatted(.number.precision(.fractionLength(0...3))) } ?? "—") + " " + record.unit
    }

    private func typeLabel(_ id: String) -> String {
        let names: [String: (String, String)] = [
            "HKQuantityTypeIdentifierStepCount": ("步数", "Steps"),
            "HKQuantityTypeIdentifierActiveEnergyBurned": ("活动能量", "Active energy"),
            "HKQuantityTypeIdentifierHeartRate": ("心率", "Heart rate"),
            "HKQuantityTypeIdentifierRestingHeartRate": ("静息心率", "Resting heart rate"),
            "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": ("HRV（SDNN）", "HRV (SDNN)"),
            "HKCategoryTypeIdentifierSleepAnalysis": ("睡眠阶段", "Sleep stages"),
            "HKWorkoutTypeIdentifier": ("训练", "Workouts")
        ]
        return names[id].map { store.text($0.0, $0.1) } ?? id
    }
}
