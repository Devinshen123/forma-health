import SwiftUI
import FormaCore

@MainActor
struct TrainingView: View {
    let store: AppStore
    @State private var showingEditor = false
    @State private var workbench: FeatureWorkbenchRoute?

    private var summary: TrainingMetrics { Metrics.trainingSummary(store.records("workouts")) }
    private var workouts: [FeatureRecord] { FeatureFormat.rows(FeatureFormat.latest(store.records("workouts"))) }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                FeatureAction(title: store.text("快速记录训练", "Quick training record"), symbol: "plus", identifier: "training.add") { showingEditor = true }
                FeatureCard {
                    Text(store.text("全部已保存训练", "All saved training")).font(.headline)
                    FeatureMetric(title: store.text("有效总分钟", "Recorded minutes"), value: FeatureFormat.number(summary.minutes, language: store.language), unit: store.text("分钟", "min"), identifier: "training.summary.minutes")
                    HStack(alignment: .top, spacing: 18) {
                        FeatureMetric(title: store.text("完成工作 / 递减组", "Work / drop sets"), value: FeatureFormat.number(summary.completedSets.map { Double($0) }, language: store.language), unit: store.text("实际逐组记录", "Actual set records"), identifier: "training.summary.sets")
                        FeatureMetric(title: store.text("已知容量", "Known volume"), value: FeatureFormat.number(summary.volumeKg, language: store.language, digits: 3), unit: "kg × " + store.text("次", "reps"), identifier: "training.summary.volume")
                    }
                    Text(store.text("\(summary.sessions) 次记录：\(summary.detailedSessions) 次含逐组数据，\(summary.summarySessions) 次仅汇总。\(summary.unknownLoadSets) 个完成组无法计算容量。汇总不推算成逐组数据。", "\(summary.sessions) saved sessions: \(summary.detailedSessions) with set details and \(summary.summarySessions) summaries only. Volume is unavailable for \(summary.unknownLoadSets) completed sets. Summaries are not converted into invented sets."))
                        .font(.footnote).foregroundStyle(FeatureTheme.muted)
                }
                FeatureCard {
                    Text(store.text("完整训练工具", "Complete training tools")).font(.headline)
                    workbenchButton(store.text("训练工作台", "Training workbench"), symbol: "dumbbell", id: "training.workbench", route: .home)
                    workbenchButton(store.text("动作库", "Exercise library"), symbol: "figure.strengthtraining.traditional", id: "training.library", route: .library)
                    workbenchButton(store.text("详细统计", "Detailed statistics"), symbol: "chart.bar", id: "training.statistics", route: .stats)
                    Text(store.text("详细工具连接同一 Forma 账户。工作台图表仅使用工作台原始记录，原生汇总不会反向加入。", "These tools use your Forma account. Workbench charts use workbench records; native summaries are not copied back into them."))
                        .font(.footnote).foregroundStyle(FeatureTheme.muted)
                }
                Text(store.text("训练历史", "Training history")).font(.title3.weight(.semibold))
                if workouts.isEmpty {
                    FeatureEmpty(title: store.text("还没有训练记录", "No training records yet"), message: store.text("记录真实时长和动作摘要，或使用工作台逐组训练。", "Record an actual duration and exercise summary, or use the workbench for set logging."), symbol: "dumbbell")
                }
                ForEach(workouts) { row in TrainingHistoryCard(record: row.value, store: store) }
            }.padding(20)
        }
        .background(FeatureTheme.background)
        .navigationTitle(store.text("训练", "Training"))
        .refreshable { await store.refresh() }
        .sheet(isPresented: $showingEditor) { WorkoutEditor(store: store) }
        .sheet(item: $workbench) { route in FeatureWorkbenchSheet(store: store, route: route) }
        .accessibilityIdentifier("screen.training")
    }

    private func workbenchButton(_ title: String, symbol: String, id: String, route: FeatureWorkbenchRoute) -> some View {
        Button { workbench = route } label: {
            HStack { Label(title, systemImage: symbol); Spacer(); Image(systemName: "chevron.right") }
                .frame(minHeight: 44).contentShape(Rectangle())
        }
        .foregroundStyle(FeatureTheme.ink).accessibilityIdentifier(id)
    }
}

@MainActor
private struct TrainingHistoryCard: View {
    let record: JSONValue
    let store: AppStore

    private var detailed: Bool { (record["exercises"].arrayValue ?? []).contains { $0["setLogs"].arrayValue != nil } }

    var body: some View {
        FeatureCard {
            Text(record["name"].stringValue ?? "—").font(.headline)
            Text((record["date"].stringValue ?? "—") + " · " + FeatureFormat.number(record["duration"].doubleValue, language: store.language) + store.text(" 分钟", " min"))
                .font(.subheadline).foregroundStyle(FeatureTheme.muted)
            Text(detailed ? store.text("含实际逐组记录", "Includes actual set records") : store.text("动作摘要；没有逐组数据", "Exercise summary; no individual set records"))
                .font(.footnote).foregroundStyle(FeatureTheme.muted)
            if let notes = record["notes"].stringValue, !notes.isEmpty { Text(notes).font(.subheadline) }
        }
    }
}

@MainActor
private struct WorkoutEditor: View {
    @Environment(\.dismiss) private var dismiss
    let store: AppStore
    @State private var boundAccount: String?
    @State private var name = ""
    @State private var exercise = ""
    @State private var date = Date()
    @State private var duration = ""
    @State private var sets = ""
    @State private var reps = ""
    @State private var weight = ""
    @State private var notes = ""
    @State private var saving = false
    @State private var cachedRecord: JSONValue?
    @State private var message: String?

    init(store: AppStore) {
        self.store = store
        _boundAccount = State(initialValue: store.user?.id)
    }

    private var canSave: Bool {
        !store.isDemo && !store.isBusy && boundAccount != nil && boundAccount == store.user?.id &&
        (cachedRecord != nil || (!name.isEmpty && !exercise.isEmpty && FeatureFormat.input(duration) != nil && Int(sets) != nil && Int(reps) != nil && FeatureFormat.input(weight) != nil))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section { RecordNotice(store: store, locked: cachedRecord != nil) }
                Section(store.text("这次训练", "This session")) {
                    TextField(store.text("训练名称", "Session name"), text: $name).accessibilityIdentifier("record.name")
                    DatePicker(store.text("日期", "Date"), selection: $date, displayedComponents: .date)
                    TextField(store.text("实际时长（分钟）", "Actual duration (min)"), text: $duration).keyboardType(.decimalPad).accessibilityIdentifier("record.duration")
                }.disabled(saving || cachedRecord != nil)
                Section(store.text("实际动作摘要", "Actual exercise summary")) {
                    TextField(store.text("动作名称", "Exercise name"), text: $exercise).accessibilityIdentifier("record.exercise")
                    TextField(store.text("完成组数", "Sets performed"), text: $sets).keyboardType(.numberPad).accessibilityIdentifier("record.sets")
                    TextField(store.text("每组次数", "Reps per set"), text: $reps).keyboardType(.numberPad).accessibilityIdentifier("record.reps")
                    TextField(store.text("实际负重（kg）", "Actual load (kg)"), text: $weight).keyboardType(.decimalPad).accessibilityIdentifier("record.weight")
                    Text(store.text("本表使用公斤；明确无负重时填写0。组间数值不同、计时或有氧训练请使用工作台。摘要不会变成逐组记录。", "This form uses kilograms; enter 0 for known unweighted work. Use the workbench for varying sets, timed or cardio training. A summary is not converted into individual sets."))
                        .font(.footnote).foregroundStyle(FeatureTheme.muted)
                }.disabled(saving || cachedRecord != nil)
                Section(store.text("备注", "Notes")) {
                    TextField(store.text("可选备注", "Optional notes"), text: $notes, axis: .vertical).lineLimit(3...6)
                }.disabled(saving || cachedRecord != nil)
                if let message { Section { Text(message).foregroundStyle(.red).accessibilityIdentifier("record.error") } }
            }
            .scrollContentBackground(.hidden).background(FeatureTheme.background)
            .navigationTitle(store.text("快速记录训练", "Quick training record"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { RecordToolbar(store: store, canSave: canSave, saving: saving, retry: cachedRecord != nil, save: beginSave, cancel: { dismiss() }) }
        }
        .interactiveDismissDisabled(saving)
        .accessibilityIdentifier(store.isDemo ? "demo.form" : "record.form")
    }

    private func beginSave() { Task { await save() } }

    private func save() async {
        guard canSave, !saving else { return }
        saving = true; message = nil
        defer { saving = false }
        do {
            let record: JSONValue
            if let cachedRecord { record = cachedRecord }
            else {
                guard let minutes = FeatureFormat.input(duration), let setCount = Int(sets), let repCount = Int(reps), let load = FeatureFormat.input(weight) else { return }
                record = try NativeRecords.workout(name: name, date: date, duration: minutes, exerciseName: exercise, sets: setCount, reps: repCount, weight: load, notes: notes)
                cachedRecord = record
            }
            try await store.saveRecord(collection: "workouts", value: record)
            if boundAccount == store.user?.id { dismiss() }
        } catch {
            if error is NativeRecordError {
                message = store.text("请核对名称、实际时长、动作、组数、次数与公斤负重。", "Check the name, actual duration, exercise, sets, reps and kilogram load.")
            } else {
                message = store.error ?? store.message(error)
            }
        }
    }
}
