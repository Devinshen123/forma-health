import Foundation
import SwiftUI
import FormaCore

/// The plan page. Versions are append-only: an edit, an accepted suggestion and an undo each add
/// a version with its reason. Nothing deletes history, and no recorded food, training or sleep
/// fact is changed from here.
@MainActor
struct PlanView: View {
    let store: AppStore
    @State private var editor: PlanEditorFields?

    private var proposed: [SuggestionView] { store.proposedSuggestions }
    private var sortedVersions: [PlanVersionView] {
        store.planVersions.sorted { $0.createdAt > $1.createdAt }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let error = store.planError {
                    FeatureCard {
                        Text(error).font(.footnote).foregroundStyle(.red)
                            .accessibilityIdentifier("plan.error")
                        if store.hasUnconfirmedPlanSave {
                            Button(store.text("重试这次保存", "Retry this save")) {
                                Task { await store.retryUnconfirmedPlanSave() }
                            }
                            .font(.subheadline)
                            .disabled(store.isBusy)
                            .accessibilityIdentifier("plan.retry")
                        }
                    }
                }
                if let plan = store.currentPlan {
                    current(plan)
                    suggestions(plan)
                    history()
                } else {
                    FeatureEmpty(title: store.text("还没有计划", "No plan yet"),
                                 message: store.text("完成引导后，第一版计划会出现在这里。",
                                                     "Your first plan version appears here once onboarding is done."),
                                 symbol: "list.bullet.rectangle")
                }
            }
            .padding(20)
        }
        .background(FeatureTheme.background)
        .navigationTitle(store.text("计划", "Plan"))
        .refreshable { await store.refresh() }
        .accessibilityIdentifier("screen.plan")
        .sheet(item: $editor) { fields in
            PlanEditorSheet(store: store, fields: fields)
        }
    }

    // MARK: - Sections

    private func current(_ plan: PlanVersionView) -> some View {
        FeatureCard {
            RecordNotice(store: store, locked: false)
            Text(store.text("当前计划", "Current plan")).font(.headline)
            Text(store.text("来源：你的设置与固定模板。当前安排不调用 AI；营养目标只采用你自己填写的数值。",
                            "From your own settings and a fixed template. No AI is used here, and nutrition targets are only the ones you entered."))
                .font(.caption).foregroundStyle(FeatureTheme.muted)
            VStack(alignment: .leading, spacing: 14) {
                row(store.text("每周训练天数", "Training days"), plan.fields.trainingDays,
                    store.text("天 / 周", "days / week"), "plan.trainingDays")
                row(store.text("每次训练时间", "Session length"), plan.fields.trainingMinutes,
                    store.text("分钟 / 次", "min / session"), "plan.trainingMinutes")
                row(store.text("计划睡眠时间", "Planned sleep"), plan.fields.sleepHours,
                    store.text("小时 / 晚", "hours / night"), "plan.sleepHours")
                row(store.text("能量目标", "Energy target"), plan.fields.calorieTarget, "kcal", "plan.calorieTarget")
                row(store.text("蛋白质目标", "Protein target"), plan.fields.proteinTarget, "g", "plan.proteinTarget")
            }
            Text(store.text("版本创建于 \(FeatureFormat.dateTime(plan.createdAt, language: store.language))",
                            "Version created \(FeatureFormat.dateTime(plan.createdAt, language: store.language))"))
                .font(.caption2).foregroundStyle(FeatureTheme.muted)
            FeatureAction(title: store.text("编辑计划", "Edit plan"), symbol: "pencil", identifier: "plan.edit") {
                editor = PlanEditorFields(plan: plan)
            }
            .disabled(store.isBusy)
            if let undoable = store.undoableSuggestion {
                Button(store.text("撤销上次调整", "Undo the last adjustment")) {
                    Task { await store.undoSuggestion() }
                }
                .font(.subheadline)
                .disabled(store.isBusy)
                .accessibilityIdentifier("plan.undo")
                Text(store.text("撤销会新建一个恢复版本，不删除历史，也不改动已记录的饮食和训练。",
                                "Undo adds a restoring version. It deletes no history and changes no recorded food or training."))
                    .font(.caption2).foregroundStyle(FeatureTheme.muted)
                    .accessibilityIdentifier("plan.undo.note")
                    .accessibilityValue(undoable.id)
            }
        }
    }

    private func suggestions(_ plan: PlanVersionView) -> some View {
        FeatureCard {
            Text(store.text("待确认的调整", "Adjustments to review")).font(.headline)
            if proposed.isEmpty {
                Text(store.text("现在没有待确认的调整。", "Nothing is waiting for your decision."))
                    .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                    .accessibilityIdentifier("plan.suggestions.empty")
            }
            ForEach(proposed) { suggestion in
                VStack(alignment: .leading, spacing: 8) {
                    Text(reasonText(suggestion.reason)).font(.subheadline.weight(.semibold))
                    if suggestion.baseVersionId == plan.id {
                        ForEach(diff(suggestion, plan), id: \.label) { change in
                            HStack(spacing: 6) {
                                Text(change.label).font(.caption).foregroundStyle(FeatureTheme.muted)
                                Spacer(minLength: 0)
                                Text(change.before).font(.caption)
                                Image(systemName: "arrow.right").font(.caption2).accessibilityHidden(true)
                                Text(change.after).font(.caption.weight(.semibold))
                            }
                        }
                        HStack(spacing: 12) {
                            Button(store.text("接受", "Accept")) {
                                Task { await store.acceptSuggestion(suggestion.id) }
                            }
                            .disabled(store.isBusy)
                            .accessibilityIdentifier("plan.accept.\(suggestion.id)")
                            Button(store.text("不采用", "Decline")) {
                                Task { await store.rejectSuggestion(suggestion.id) }
                            }
                            .disabled(store.isBusy)
                            .accessibilityIdentifier("plan.reject.\(suggestion.id)")
                        }
                        .font(.subheadline)
                    } else {
                        // The plan moved on, so the before/after this suggestion describes no
                        // longer matches what is current. Never apply it silently.
                        Text(store.text("这条建议基于较早的计划版本，已不能直接接受。请刷新后重新评估。",
                                        "This suggestion is based on an earlier plan version and cannot be accepted as it is. Refresh and review again."))
                            .font(.caption).foregroundStyle(FeatureTheme.muted)
                            .accessibilityIdentifier("plan.suggestion.stale.\(suggestion.id)")
                        Button(store.text("不采用", "Decline")) {
                            Task { await store.rejectSuggestion(suggestion.id) }
                        }
                        .font(.subheadline)
                        .disabled(store.isBusy)
                        .accessibilityIdentifier("plan.reject.\(suggestion.id)")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Text(store.text("建议来自确定性规则，理由引用你自己的记录；接受前后都由你决定。",
                            "Suggestions come from deterministic rules and cite your own records. The decision stays yours."))
                .font(.caption2).foregroundStyle(FeatureTheme.muted)
        }
    }

    private func history() -> some View {
        FeatureCard {
            Text(store.text("版本历史", "Version history")).font(.headline)
            ForEach(sortedVersions) { version in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: version.id == store.currentPlan?.id ? "largecircle.fill.circle" : "circle")
                        .font(.caption).foregroundStyle(FeatureTheme.muted).accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(reasonText(version.reason)).font(.subheadline)
                        Text(FeatureFormat.dateTime(version.createdAt, language: store.language))
                            .font(.caption2).foregroundStyle(FeatureTheme.muted)
                    }
                    Spacer(minLength: 0)
                    Text(store.text("\(FeatureFormat.number(version.fields.trainingDays, language: store.language, digits: 0)) 天 · \(FeatureFormat.number(version.fields.sleepHours, language: store.language)) 小时",
                                    "\(FeatureFormat.number(version.fields.trainingDays, language: store.language, digits: 0))d · \(FeatureFormat.number(version.fields.sleepHours, language: store.language))h"))
                        .font(.caption).foregroundStyle(FeatureTheme.muted)
                }
                .accessibilityElement(children: .combine)
            }
            if sortedVersions.isEmpty {
                Text(store.text("还没有版本记录。", "No versions recorded yet."))
                    .font(.subheadline).foregroundStyle(FeatureTheme.muted)
            }
            Text(store.text("版本只追加，不覆盖。共 \(sortedVersions.count) 个版本。",
                            "Versions are only ever added, never overwritten. \(sortedVersions.count) in total."))
                .font(.caption2).foregroundStyle(FeatureTheme.muted)
                .accessibilityIdentifier("plan.history.count")
        }
    }

    // MARK: - Presentation

    private func row(_ title: String, _ value: Double?, _ unit: String, _ identifier: String) -> some View {
        HStack {
            Text(title).font(.subheadline).foregroundStyle(FeatureTheme.muted)
            Spacer(minLength: 0)
            // A target the user never set shows as — , never as zero.
            Text(FeatureFormat.number(value, language: store.language))
                .font(.headline).accessibilityIdentifier(identifier)
            Text(unit).font(.caption).foregroundStyle(FeatureTheme.muted)
        }
    }

    private struct PlanChangeRow {
        let label: String
        let before: String
        let after: String
    }

    private func diff(_ suggestion: SuggestionView, _ plan: PlanVersionView) -> [PlanChangeRow] {
        let after = PlanOperations.apply(suggestion.patch, to: plan.fields)
        var rows: [PlanChangeRow] = []
        func add(_ label: String, _ before: Double, _ next: Double, digits: Int) {
            guard before != next else { return }
            rows.append(PlanChangeRow(label: label,
                                      before: FeatureFormat.number(before, language: store.language, digits: digits),
                                      after: FeatureFormat.number(next, language: store.language, digits: digits)))
        }
        add(store.text("训练天数", "Training days"), plan.fields.trainingDays, after.trainingDays, digits: 0)
        add(store.text("训练时间", "Session length"), plan.fields.trainingMinutes, after.trainingMinutes, digits: 0)
        add(store.text("睡眠", "Sleep"), plan.fields.sleepHours, after.sleepHours, digits: 1)
        return rows
    }

    /// Reasons arrive as stable keys from the service; unknown keys are shown as they are rather
    /// than invented into friendly copy.
    private func reasonText(_ reason: String) -> String {
        switch reason {
        case "onboarding.initial":
            return store.text("初始计划由你确认", "You confirmed your starting plan")
        case "plan.user_edit":
            return store.text("你主动修改了计划参数", "You changed your plan settings")
        case "suggestion.time_limited":
            return store.text("你主动选择缩短训练。将每次训练目标改为 30 分钟，保留原有训练天数与其他目标；今后的安排也会采用这一目标，可以撤销。",
                              "You chose shorter training. This changes every session target to 30 minutes and keeps your training days and other targets. Future sessions use this target, and you can undo it.")
        case "suggestion.undo":
            return store.text("恢复调整前的参数，保留版本历史",
                              "Restored the earlier settings and kept the version history")
        default:
            return reason
        }
    }
}

/// The editable values as text, so a half-typed field is never read as a number.
struct PlanEditorFields: Identifiable {
    let id: String
    var trainingMinutes: String
    var trainingDays: String
    var sleepHours: String
    var calorieTarget: String
    var proteinTarget: String

    init(plan: PlanVersionView) {
        id = plan.id
        trainingMinutes = PlanEditorFields.text(plan.fields.trainingMinutes)
        trainingDays = PlanEditorFields.text(plan.fields.trainingDays)
        sleepHours = PlanEditorFields.text(plan.fields.sleepHours)
        calorieTarget = PlanEditorFields.text(plan.fields.calorieTarget)
        proteinTarget = PlanEditorFields.text(plan.fields.proteinTarget)
    }

    /// Plain editable text, not a localised display string. A target that was never set is blank.
    static func text(_ value: Double?) -> String {
        guard let value, value.isFinite else { return "" }
        if value.rounded() == value, abs(value) < 1e9 { return String(Int(value)) }
        return String(value)
    }

    /// nil when a required field is unusable; the optional targets stay nil when left blank.
    var fields: PlanFields? {
        guard let minutes = FeatureFormat.input(trainingMinutes),
              let days = FeatureFormat.input(trainingDays),
              let sleep = FeatureFormat.input(sleepHours) else { return nil }
        let kcal = calorieTarget.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : FeatureFormat.input(calorieTarget)
        if !calorieTarget.trimmingCharacters(in: .whitespaces).isEmpty && kcal == nil { return nil }
        let protein = proteinTarget.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : FeatureFormat.input(proteinTarget)
        if !proteinTarget.trimmingCharacters(in: .whitespaces).isEmpty && protein == nil { return nil }
        return PlanFields(trainingMinutes: minutes, trainingDays: days, sleepHours: sleep,
                          calorieTarget: kcal, proteinTarget: protein)
    }
}

@MainActor
struct PlanEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    let store: AppStore
    @State private var values: PlanEditorFields
    @State private var saving = false

    init(store: AppStore, fields: PlanEditorFields) {
        self.store = store
        _values = State(initialValue: fields)
    }

    private var ready: Bool { values.fields.map(PlanRules.valid) ?? false }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    field(store.text("每周训练天数（1–7）", "Training days (1–7)"), $values.trainingDays, "plan.editor.trainingDays")
                    field(store.text("每次训练时间（10–180 分钟）", "Session length (10–180 min)"), $values.trainingMinutes, "plan.editor.trainingMinutes")
                    field(store.text("计划睡眠（4–12 小时）", "Planned sleep (4–12 hours)"), $values.sleepHours, "plan.editor.sleepHours")
                } footer: {
                    Text(store.text("保存后会新建一个版本。历史计划与已记录的事实都会保留。",
                                    "Saving adds a new version. Earlier plans and every recorded fact are kept."))
                }
                Section {
                    field(store.text("每日能量目标（kcal，可选）", "Daily energy target (kcal, optional)"), $values.calorieTarget, "plan.editor.calorieTarget")
                    field(store.text("每日蛋白质目标（g，可选）", "Daily protein target (g, optional)"), $values.proteinTarget, "plan.editor.proteinTarget")
                } footer: {
                    Text(store.text("留空即取消该目标；留空不等于 0。",
                                    "Leave a target blank to remove it. Blank is not zero."))
                }
                if let error = store.planError {
                    Section {
                        Text(error).font(.footnote).foregroundStyle(.red)
                            .accessibilityIdentifier("plan.editor.error")
                    }
                }
            }
            .navigationTitle(store.text("调整你的计划", "Adjust your plan"))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(store.text("取消", "Cancel")) { dismiss() }
                        .disabled(saving).accessibilityIdentifier("plan.editor.cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        guard let fields = values.fields else { return }
                        saving = true
                        Task {
                            await store.editPlan(fields)
                            saving = false
                            if store.planError == nil { dismiss() }
                        }
                    } label: {
                        if saving { ProgressView() } else { Text(store.text("保存新版本", "Save new version")) }
                    }
                    .disabled(!ready || saving)
                    .accessibilityIdentifier("plan.editor.save")
                }
            }
        }
    }

    private func field(_ title: String, _ value: Binding<String>, _ identifier: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption).foregroundStyle(FeatureTheme.muted)
            TextField(title, text: value)
                .keyboardType(.decimalPad)
                .accessibilityIdentifier(identifier)
        }
    }
}

/// A compact entry point on the today page, mirroring the website's own plan page link.
@MainActor
struct PlanCard: View {
    let store: AppStore

    var body: some View {
        FeatureCard {
            NavigationLink {
                PlanView(store: store)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "list.bullet.rectangle").font(.title3)
                        .foregroundStyle(FeatureTheme.ink).accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(store.text("计划", "Plan")).font(.headline).foregroundStyle(FeatureTheme.ink)
                        Text(summary).font(.subheadline).foregroundStyle(FeatureTheme.muted)
                            .accessibilityIdentifier("plan.card.summary")
                    }
                    Spacer(minLength: 0)
                    if !store.proposedSuggestions.isEmpty {
                        Text(store.text("\(store.proposedSuggestions.count) 待确认",
                                        "\(store.proposedSuggestions.count) to review"))
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(FeatureTheme.accent, in: Capsule())
                            .accessibilityIdentifier("plan.card.pending")
                    }
                    Image(systemName: "chevron.right").font(.footnote)
                        .foregroundStyle(FeatureTheme.muted).accessibilityHidden(true)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("plan.card")
        }
    }

    private var summary: String {
        guard let plan = store.currentPlan else {
            return store.text("还没有计划", "No plan yet")
        }
        let days = FeatureFormat.number(plan.fields.trainingDays, language: store.language, digits: 0)
        let minutes = FeatureFormat.number(plan.fields.trainingMinutes, language: store.language, digits: 0)
        let sleep = FeatureFormat.number(plan.fields.sleepHours, language: store.language)
        return store.text("每周 \(days) 天 · 每次 \(minutes) 分钟 · 睡眠 \(sleep) 小时",
                          "\(days) days/week · \(minutes) min/session · \(sleep)h sleep")
    }
}
