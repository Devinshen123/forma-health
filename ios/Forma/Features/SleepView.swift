import SwiftUI
import FormaCore

@MainActor
struct SleepView: View {
    let store: AppStore
    @State private var showingEditor = false
    @State private var editing: FeatureRecord?

    private var summary: DayMetrics { Metrics.dailySummary(state: store.state, date: Date()) }
    private var sleeps: [FeatureRecord] { FeatureFormat.rows(FeatureFormat.latest(store.records("sleeps"))) }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                FeatureAction(title: store.text("记录睡眠与状态", "Record sleep and energy"), symbol: "plus", identifier: "sleep.add") { showingEditor = true }
                FeatureCard {
                    FeatureMetric(title: store.text("今天醒来的睡眠", "Sleep ending today"), value: FeatureFormat.number(summary.sleepHours, language: store.language), unit: store.text("小时", "hours"), identifier: "sleep.total.hours")
                    Text(store.text("按记录的时区与醒来日期汇总；重叠时段不会重复计算。没有记录时显示—。", "Grouped by the recorded time zone and wake-up date. Overlapping periods count once; missing records remain —."))
                        .font(.footnote).foregroundStyle(FeatureTheme.muted)
                }
                Text(store.text("睡眠历史", "Sleep history")).font(.title3.weight(.semibold))
                if sleeps.isEmpty {
                    FeatureEmpty(title: store.text("还没有睡眠记录", "No sleep records yet"), message: store.text("手动记录真实入睡和醒来时间，再选择当时的感受与精力。", "Record actual sleep and wake-up times, then choose your sleep quality and energy."), symbol: "moon")
                }
                ForEach(sleeps) { row in
                    Button { editing = row } label: { SleepHistoryCard(record: row.value, store: store) }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("sleep.record.\(row.value["id"].stringValue ?? "")")
                }
            }.padding(20)
        }
        .background(FeatureTheme.background)
        .navigationTitle(store.text("睡眠", "Sleep"))
        .refreshable { await store.refresh() }
        .sheet(isPresented: $showingEditor) { SleepEditor(store: store) }
        .sheet(item: $editing) { row in SleepEditor(store: store, existing: row.value) }
        .accessibilityIdentifier("screen.sleep")
    }
}

@MainActor
private struct SleepHistoryCard: View {
    let record: JSONValue
    let store: AppStore

    private var hours: Double? {
        guard let start = FeatureFormat.instant(record["start"].stringValue), let end = FeatureFormat.instant(record["end"].stringValue) else { return nil }
        let interval = end.timeIntervalSince(start)
        return interval > 0 && interval <= 86400 ? interval / 3600 : nil
    }

    private var summaryText: String {
        let day = record["date"].stringValue ?? "—"
        let duration = FeatureFormat.number(hours, language: store.language)
        let unit = store.text(" 小时", " hours")
        return "\(day) · \(duration)\(unit)"
    }

    private var timeRangeText: String {
        let start = FeatureFormat.dateTime(record["start"].stringValue, language: store.language)
        let end = FeatureFormat.dateTime(record["end"].stringValue, language: store.language)
        return "\(start) → \(end)"
    }

    private var qualityText: String {
        "\(store.text("睡眠感受", "Sleep quality")) \(SleepRating.text(record["quality"].intValue, .quality, store: store))"
    }

    private var energyText: String {
        "\(store.text("精力", "Energy")) \(SleepRating.text(record["energy"].intValue, .energy, store: store))"
    }

    private var ratingsText: String { "\(qualityText) · \(energyText)" }
    private var timezoneText: String { record["timezone"].stringValue ?? "—" }

    var body: some View {
        FeatureCard {
            Text(summaryText).font(.headline)
            Text(timeRangeText).font(.subheadline).foregroundStyle(FeatureTheme.muted)
            Text(ratingsText)
                .font(.footnote).foregroundStyle(FeatureTheme.muted)
            Text(timezoneText).font(.caption).foregroundStyle(FeatureTheme.muted)
        }
    }
}

@MainActor
private struct SleepEditor: View {
    @Environment(\.dismiss) private var dismiss
    let store: AppStore
    @State private var boundAccount: String?
    @State private var start: Date
    @State private var end: Date
    @State private var quality: Int?
    @State private var energy: Int?
    @State private var timezone = TimeZone.current.identifier
    @State private var saving = false
    @State private var cachedRecord: JSONValue?
    @State private var message: String?
    @State private var confirmDelete = false
    /// The saved sleep being corrected, or nil for a new one.
    private let existing: JSONValue?

    init(store: AppStore, existing: JSONValue? = nil) {
        self.store = store
        self.existing = existing
        let now = Date()
        _boundAccount = State(initialValue: store.user?.id)
        _start = State(initialValue: FeatureFormat.instant(existing?["start"].stringValue) ?? now)
        _end = State(initialValue: FeatureFormat.instant(existing?["end"].stringValue) ?? now)
        _quality = State(initialValue: existing?["quality"].intValue)
        _energy = State(initialValue: existing?["energy"].intValue)
        _timezone = State(initialValue: existing?["timezone"].stringValue ?? TimeZone.current.identifier)
    }

    private var canSave: Bool {
        !store.isDemo && !store.isBusy && boundAccount != nil && boundAccount == store.user?.id &&
        (cachedRecord != nil || (end > start && quality != nil && energy != nil))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section { RecordNotice(store: store, locked: cachedRecord != nil) }
                Section(store.text("实际时间", "Actual times")) {
                    DatePicker(store.text("入睡", "Fell asleep"), selection: $start, displayedComponents: [.date, .hourAndMinute]).accessibilityIdentifier("record.sleep.start")
                    DatePicker(store.text("醒来", "Woke up"), selection: $end, displayedComponents: [.date, .hourAndMinute]).accessibilityIdentifier("record.sleep.end")
                    TextField(store.text("IANA时区", "IANA time zone"), text: $timezone).textInputAutocapitalization(.never).autocorrectionDisabled()
                    Text(store.text("请选择实际入睡和醒来时间，跨夜记录归到醒来当天。", "Choose your actual sleep and wake-up times. Overnight sleep belongs to the wake-up day."))
                        .font(.footnote).foregroundStyle(FeatureTheme.muted)
                }.disabled(saving || cachedRecord != nil)
                Section(store.text("醒来后的状态", "How you felt after waking")) {
                    ratingPicker(store.text("睡眠感受", "Sleep quality"), value: $quality, kind: .quality)
                    ratingPicker(store.text("醒来精力", "Energy on waking"), value: $energy, kind: .energy)
                    Text(store.text("这是你自行填写的感受，不是健康评分或诊断。", "These are your own observations, not a health score or diagnosis."))
                        .font(.footnote).foregroundStyle(FeatureTheme.muted)
                }.disabled(saving || cachedRecord != nil)
                if existing != nil {
                    Section {
                        Button(store.text("删除这段睡眠", "Delete this sleep"), role: .destructive) { confirmDelete = true }
                            .disabled(saving || store.isDemo)
                            .accessibilityIdentifier("record.delete")
                    } footer: {
                        Text(store.text("删除后，这段睡眠不再计入休息与趋势。", "Once deleted, this sleep no longer counts toward rest or trends."))
                    }
                }
                if let message { Section { Text(message).foregroundStyle(.red).accessibilityIdentifier("record.error") } }
            }
            .scrollContentBackground(.hidden).background(FeatureTheme.background)
            .navigationTitle(existing == nil ? store.text("记录睡眠", "Record sleep") : store.text("编辑这段睡眠", "Edit this sleep"))
            .confirmationDialog(store.text("删除这段睡眠？", "Delete this sleep?"), isPresented: $confirmDelete, titleVisibility: .visible) {
                Button(store.text("删除记录", "Delete record"), role: .destructive) { Task { await delete() } }
                Button(store.text("取消", "Cancel"), role: .cancel) {}
            } message: {
                Text(store.text("删除后，这段睡眠不再计入休息与趋势。", "Once deleted, this sleep no longer counts toward rest or trends."))
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { RecordToolbar(store: store, canSave: canSave, saving: saving, retry: cachedRecord != nil, save: beginSave, cancel: { dismiss() }) }
        }
        .interactiveDismissDisabled(saving)
        .accessibilityIdentifier(store.isDemo ? "demo.form" : "record.form")
    }

    private func ratingPicker(_ title: String, value: Binding<Int?>, kind: SleepRating.Kind) -> some View {
        Picker(title, selection: value) {
            Text(store.text("请选择", "Choose")).tag(Optional<Int>.none)
            ForEach(1...5, id: \.self) { rating in
                Text(SleepRating.text(rating, kind, store: store)).tag(Optional(rating))
            }
        }
    }

    private func beginSave() { Task { await save() } }

    private func delete() async {
        guard let id = existing?["id"].stringValue, !saving else { return }
        saving = true; message = nil
        defer { saving = false }
        do {
            try await store.deleteRecord(collection: "sleeps", id: id)
            if boundAccount == store.user?.id { dismiss() }
        } catch {
            message = store.error ?? store.message(error)
        }
    }

    private func save() async {
        guard canSave, !saving else { return }
        saving = true; message = nil
        defer { saving = false }
        do {
            let record: JSONValue
            if let cachedRecord { record = cachedRecord }
            else {
                guard let quality, let energy else { return }
                let fresh = try NativeRecords.sleep(start: start, end: end, quality: quality, energy: energy, timezone: timezone)
                record = existing.map { NativeRecords.revised($0, with: fresh) } ?? fresh
                cachedRecord = record
            }
            try await store.saveRecord(collection: "sleeps", value: record)
            if boundAccount == store.user?.id { dismiss() }
        } catch {
            if error is NativeRecordError {
                message = store.text("请核对入睡、醒来、时区与感受；时长须在0至24小时之间。", "Check sleep and wake-up times, time zone and ratings; duration must be greater than 0 and at most 24 hours.")
            } else {
                message = store.error ?? store.message(error)
            }
        }
    }
}

/// The website's words for the two self-reported ratings, shown beside the number as it shows
/// them: "3 · 一般". A rating is how the person felt, so it reads as words, not as a score.
@MainActor
enum SleepRating {
    enum Kind { case quality, energy }

    static func text(_ value: Int?, _ kind: Kind, store: AppStore) -> String {
        guard let value, (1...5).contains(value) else { return "—" }
        let labels: [String]
        switch kind {
        case .quality:
            labels = store.language == "zh" ? ["很差", "较差", "一般", "良好", "很好"]
                                            : ["Very poor", "Poor", "Okay", "Good", "Very good"]
        case .energy:
            labels = store.language == "zh" ? ["很疲惫", "较疲惫", "一般", "有精神", "很充沛"]
                                            : ["Very tired", "Tired", "Okay", "Energized", "Very energized"]
        }
        return "\(value) · \(labels[value - 1])"
    }
}
