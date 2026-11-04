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
    @State private var compareBase: String?
    @State private var compareTarget: String?

    private var proposed: [SuggestionView] { store.proposedSuggestions }

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
                    comparison()
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
            // The website's "Plan versions" panel: newest first, numbered in storage order.
            Text(store.text("计划版本", "Plan versions")).font(.headline)
            ForEach(numberedVersions) { item in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: item.isCurrent ? "largecircle.fill.circle" : "circle")
                        .font(.caption).foregroundStyle(FeatureTheme.muted).accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(store.text("版本 \(item.number) · \(reasonText(item.version.reason))",
                                        "Version \(item.number) · \(reasonText(item.version.reason))"))
                            .font(.subheadline)
                        Text(summary(item.version))
                            .font(.caption2).foregroundStyle(FeatureTheme.muted)
                        if let parent = PlanComparison.parent(of: item.id, in: store.state) {
                            Button(store.text("查看差异", "Review changes")) {
                                compareBase = parent.id
                                compareTarget = item.id
                            }
                            .font(.caption)
                            .accessibilityIdentifier("plan.history.review.\(item.id)")
                        }
                    }
                    Spacer(minLength: 0)
                    if item.isCurrent {
                        Text(store.text("正在使用", "In use"))
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(FeatureTheme.accent, in: Capsule())
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("plan.history.row.\(item.id)")
            }
            if numberedVersions.isEmpty {
                Text(store.text("还没有版本记录。", "No versions recorded yet."))
                    .font(.subheadline).foregroundStyle(FeatureTheme.muted)
            }
            Text(store.text("版本只追加，不覆盖。共 \(numberedVersions.count) 个版本。",
                            "Versions are only ever added, never overwritten. \(numberedVersions.count) in total."))
                .font(.caption2).foregroundStyle(FeatureTheme.muted)
                .accessibilityIdentifier("plan.history.count")
            Text(store.text("计划目标与实际记录分别保存；修改目标不会改变历史摄入、训练或睡眠。",
                            "Targets and actual records are separate. Changing a target does not change earlier meals, training or sleep."))
                .font(.caption2).foregroundStyle(FeatureTheme.muted)
        }
    }

    /// Two saved versions side by side. Reading only: nothing here writes, so a demo can use it too.
    private func comparison() -> some View {
        FeatureCard {
            Text(store.text("比较版本", "Compare versions")).font(.headline)
            if numberedVersions.count < 2 {
                Text(store.text("目前只有一个版本，保存新版本后可以在这里比较差异。",
                                "There is only one version so far. Save a new version to compare them here."))
                    .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                    .accessibilityIdentifier("plan.compare.single")
            } else if let pair = selectedPair {
                Picker(store.text("调整前", "Before"), selection: baseSelection(pair)) {
                    ForEach(numberedVersions) { item in
                        Text(versionLabel(item)).tag(item.id)
                    }
                }
                .accessibilityIdentifier("plan.compare.base")
                Picker(store.text("调整后", "After"), selection: targetSelection(pair)) {
                    ForEach(numberedVersions) { item in
                        Text(versionLabel(item)).tag(item.id)
                    }
                }
                .accessibilityIdentifier("plan.compare.target")
                let changes = PlanComparison.compare(store.state, from: pair.base, to: pair.target) ?? []
                if pair.base == pair.target {
                    Text(store.text("请选择两个不同的版本。", "Choose two different versions."))
                        .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                        .accessibilityIdentifier("plan.compare.same")
                } else if changes.isEmpty {
                    Text(store.text("这两个版本的目标完全相同。", "These two versions have the same targets."))
                        .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                        .accessibilityIdentifier("plan.compare.none")
                } else {
                    ForEach(changes, id: \.field) { change in
                        changeRow(change)
                    }
                }
            }
            Text(store.text("比较只读取已保存的版本，不会保存或改动计划。",
                            "Comparing only reads saved versions. It saves and changes nothing."))
                .font(.caption2).foregroundStyle(FeatureTheme.muted)
                .accessibilityIdentifier("plan.compare.note")
        }
    }

    private func changeRow(_ change: PlanFieldChange) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(fieldTitle(change.field)).font(.subheadline)
                Spacer(minLength: 0)
                Text(kindText(change.kind))
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(FeatureTheme.accent, in: Capsule())
            }
            HStack(spacing: 6) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(store.text("调整前", "Before")).font(.caption2).foregroundStyle(FeatureTheme.muted)
                    Text(valueText(change.before, change.field)).font(.caption)
                }
                Image(systemName: "arrow.right").font(.caption2).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 0) {
                    Text(store.text("调整后", "After")).font(.caption2).foregroundStyle(FeatureTheme.muted)
                    Text(valueText(change.after, change.field)).font(.caption.weight(.semibold))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("plan.compare.change.\(change.field.rawValue)")
        .accessibilityValue(change.kind.rawValue)
    }

    private var numberedVersions: [NumberedPlanVersion] { PlanComparison.history(store.state) }

    /// The user's choice while both versions still exist, otherwise the current plan and its parent.
    private var selectedPair: (base: String, target: String)? {
        let ids = Set(numberedVersions.map(\.id))
        if let base = compareBase, let target = compareTarget, ids.contains(base), ids.contains(target) {
            return (base, target)
        }
        return PlanComparison.defaultPair(store.state)
    }

    private func baseSelection(_ pair: (base: String, target: String)) -> Binding<String> {
        Binding(get: { pair.base }, set: { compareBase = $0; compareTarget = pair.target })
    }

    private func targetSelection(_ pair: (base: String, target: String)) -> Binding<String> {
        Binding(get: { pair.target }, set: { compareTarget = $0; compareBase = pair.base })
    }

    private func versionLabel(_ item: NumberedPlanVersion) -> String {
        let label = store.text("版本 \(item.number)", "Version \(item.number)")
        return item.isCurrent ? label + store.text("（正在使用）", " (in use)") : label
    }

    private func summary(_ version: PlanVersionView) -> String {
        let date = FeatureFormat.dateTime(version.createdAt, language: store.language)
        let days = FeatureFormat.number(version.fields.trainingDays, language: store.language)
        let minutes = FeatureFormat.number(version.fields.trainingMinutes, language: store.language)
        let sleep = FeatureFormat.number(version.fields.sleepHours, language: store.language)
        return store.text("\(date) · \(days) 天 / 周 · \(minutes) 分钟 / 次 · \(sleep) 小时 / 晚",
                          "\(date) · \(days) days / week · \(minutes) min / session · \(sleep) hours / night")
    }

    private func fieldTitle(_ field: PlanFieldKey) -> String {
        switch field {
        case .trainingDays: return store.text("每周训练天数", "Training days per week")
        case .trainingMinutes: return store.text("每次训练时间", "Time per session")
        case .sleepHours: return store.text("计划睡眠时间", "Planned sleep time")
        case .calorieTarget: return store.text("能量目标", "Energy target")
        case .proteinTarget: return store.text("蛋白质目标", "Protein target")
        }
    }

    private func kindText(_ kind: PlanChangeKind) -> String {
        switch kind {
        case .added: return store.text("新增", "Added")
        case .removed: return store.text("取消", "Removed")
        case .changed: return store.text("变化", "Changed")
        }
    }

    /// A missing target reads as the website's "Not set", never as 0.
    private func valueText(_ value: Double?, _ field: PlanFieldKey) -> String {
        guard let value else { return store.text("暂未设置", "Not set") }
        let number = FeatureFormat.number(value, language: store.language)
        switch field {
        case .trainingDays: return store.text("\(number) 天 / 周", "\(number) days / week")
        case .trainingMinutes: return store.text("\(number) 分钟 / 次", "\(number) min / session")
        case .sleepHours: return store.text("\(number) 小时 / 晚", "\(number) hours / night")
        case .calorieTarget: return "\(number) kcal"
        case .proteinTarget: return "\(number) g"
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
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
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
