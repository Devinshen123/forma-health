import FormaCore
import SwiftUI

/// The website's six onboarding steps, natively. The answers become the profile and the first
/// plan through the same atomic plan write as every other plan change; nothing is computed for
/// the person - every number is one they typed, and an optional target left blank stays blank.
@MainActor
struct OnboardingView: View {
    let store: AppStore
    @State private var step = 0
    @State private var answers: OnboardingAnswers
    @State private var days: String
    @State private var minutes: String
    @State private var sleep: String
    @State private var calories = ""
    @State private var protein = ""
    @State private var message: String?
    @State private var saving = false

    init(store: AppStore) {
        self.store = store
        let start = OnboardingAnswers(profile: store.state["profile"])
        _answers = State(initialValue: start)
        _days = State(initialValue: Self.text(start.trainingDays))
        _minutes = State(initialValue: Self.text(start.timeMinutes))
        _sleep = State(initialValue: Self.text(start.sleepGoal))
    }

    private var titles: [String] {
        [store.text("你的目标", "Your goal"), store.text("训练节奏", "Training rhythm"),
         store.text("偏好与限制", "Preferences & limits"), store.text("休息状态", "Rest & energy"),
         store.text("可选营养目标", "Optional nutrition"), store.text("确认计划", "Review your plan")]
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ProgressView(value: Double(step + 1), total: Double(Onboarding.stepCount))
                    Text("\(step + 1) / \(Onboarding.stepCount) · \(titles[step])")
                        .font(.caption).foregroundStyle(FeatureTheme.muted)
                        .accessibilityIdentifier("onboarding.step")
                }
                switch step {
                case 0: goal
                case 1: training
                case 2: limits
                case 3: rest
                case 4: nutrition
                default: review
                }
                if let message {
                    Section {
                        Text(message).font(.footnote).foregroundStyle(.red)
                            .accessibilityIdentifier("onboarding.error")
                    }
                }
            }
            .navigationTitle(store.text("先认识你，再安排今天。", "A plan that begins with you."))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbar }
            .disabled(saving)
        }
        .interactiveDismissDisabled()
        .accessibilityIdentifier("screen.onboarding")
    }

    // MARK: - Steps

    private var goal: some View {
        Section {
            Picker(store.text("你想把哪件事练得更好？", "What would you like to work on?"), selection: $answers.goal) {
                Text(store.text("健身表现", "Fitness performance")).tag("performance")
                Text(store.text("力量与进步", "Strength & progress")).tag("strength")
                Text(store.text("长期健康习惯", "Long-term healthy habits")).tag("habits")
            }
            .pickerStyle(.inline)
            .accessibilityIdentifier("onboarding.goal")
            TextField(store.text("我们该怎么称呼你？", "What should we call you?"), text: $answers.name)
                .accessibilityIdentifier("onboarding.name")
        } footer: {
            Text(store.text("选择当前最关注的方向，之后也能调整。", "Choose what matters most right now. You can change it later."))
        }
    }

    private var training: some View {
        Section {
            Picker(store.text("训练经验", "Training experience"), selection: $answers.experience) {
                Text(store.text("刚开始", "Getting started")).tag("new")
                Text(store.text("有规律训练", "Train regularly")).tag("regular")
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("onboarding.experience")
            LabeledContent(store.text("每周训练天数", "Training days per week")) {
                TextField("3", text: $days).keyboardType(.numberPad).multilineTextAlignment(.trailing)
                    .accessibilityIdentifier("onboarding.days")
            }
            LabeledContent(store.text("每次训练时间（分钟）", "Minutes per session")) {
                TextField("45", text: $minutes).keyboardType(.numberPad).multilineTextAlignment(.trailing)
                    .accessibilityIdentifier("onboarding.minutes")
            }
            Picker(store.text("常用器械与场地", "Equipment & location"), selection: $answers.equipment) {
                Text(store.text("健身房", "Gym")).tag("gym")
                Text(store.text("居家器械", "Home equipment")).tag("home")
                Text(store.text("自重训练", "Bodyweight")).tag("bodyweight")
            }
            .accessibilityIdentifier("onboarding.equipment")
        } header: {
            Text(store.text("让训练适合你的生活。", "Fit training into your life."))
        } footer: {
            Text(store.text("先填写你实际能安排的时间；这些是你的选择，不是 AI 处方。",
                            "Choose the time you can actually set aside. These are your preferences, not an AI prescription."))
        }
    }

    private var limits: some View {
        Section {
            TextField(store.text("食物过敏（可选），例如：花生、乳制品", "Food allergies (optional), e.g. peanuts, dairy"),
                      text: $answers.allergies, axis: .vertical)
                .accessibilityIdentifier("onboarding.allergies")
            TextField(store.text("饮食偏好、饮食与活动限制（可选）", "Food preferences, dietary & activity limits (optional)"),
                      text: $answers.restrictions, axis: .vertical)
                .accessibilityIdentifier("onboarding.restrictions")
        } header: {
            Text(store.text("你的偏好和限制，值得被尊重。", "Make room for your preferences."))
        } footer: {
            Text(store.text("只填写与计划有关的信息。过敏和活动限制会作为你的备注，当前版本不自动生成食谱或医疗建议。请不要填写证件等无关信息。",
                            "Share only what is useful for your plan. Allergies and activity limits are saved as your notes; this version does not create recipes or medical advice. Do not include unrelated identifiers."))
        }
    }

    private var rest: some View {
        Section {
            LabeledContent(store.text("计划中的睡眠时间（小时）", "Planned sleep time (hours)")) {
                TextField("8", text: $sleep).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    .accessibilityIdentifier("onboarding.sleep")
            }
        } header: {
            Text(store.text("给休息留出空间。", "Leave room for rest."))
        } footer: {
            Text(store.text("这是可修改的个人目标，不代表睡眠测量或诊断。确认计划后，可以在睡眠页记录实际睡眠、主观精力与睡眠感受；单项指标或主观感觉不会自动取消训练。",
                            "This is an editable personal goal, not a measurement or diagnosis. After confirming, use the Sleep page to record actual sleep and how you felt; one metric or feeling alone will not cancel training."))
        }
    }

    private var nutrition: some View {
        Section {
            LabeledContent(store.text("每日能量目标（kcal，可选）", "Daily energy target (kcal, optional)")) {
                TextField(store.text("留空也可以", "Optional"), text: $calories).keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing).accessibilityIdentifier("onboarding.calories")
            }
            LabeledContent(store.text("每日蛋白质目标（g，可选）", "Daily protein target (g, optional)")) {
                TextField(store.text("留空也可以", "Optional"), text: $protein).keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing).accessibilityIdentifier("onboarding.protein")
            }
        } header: {
            Text(store.text("已有营养目标，就把它带进来。", "Bring a nutrition goal you already have."))
        } footer: {
            Text(store.text("如果没有确定的目标，留空即可。我们不会根据问卷自动计算减脂或医疗目标。",
                            "Leave these empty if you have not chosen a goal. We do not calculate weight-loss or medical targets from your answers."))
        }
    }

    private var review: some View {
        Section {
            LabeledContent(store.text("当前目标", "Current focus"), value: goalName)
            LabeledContent(store.text("每周训练", "Weekly training"),
                           value: store.text("\(days) 天 · \(minutes) 分钟 / 次", "\(days) days · \(minutes) min / session"))
            LabeledContent(store.text("睡眠安排", "Planned sleep"), value: store.text("\(sleep) 小时 / 晚", "\(sleep) hours / night"))
            LabeledContent(store.text("营养目标", "Nutrition goals"), value: nutritionSummary)
            LabeledContent(store.text("训练模板", "Training template")) { Text(template).multilineTextAlignment(.trailing) }
        } header: {
            Text(store.text("这是属于你的起始计划。", "Your starting plan, ready for review."))
        } footer: {
            Text(store.text("训练安排来自你填写的时间与器械、配合固定模板；当前没有调用 AI。来源：你的问卷与固定模板。",
                            "Training uses your time, equipment and a fixed template. No AI is being called. Source: your answers and a fixed template."))
        }
        .accessibilityIdentifier("onboarding.review")
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button(store.text("返回", "Back")) { message = nil; step -= 1 }
                .disabled(step == 0).accessibilityIdentifier("onboarding.back")
        }
        ToolbarItem(placement: .confirmationAction) {
            if step == Onboarding.stepCount - 1 {
                Button(saving ? store.text("正在保存…", "Saving…") : store.text("确认我的计划", "Confirm my plan")) {
                    Task { await confirm() }
                }
                .accessibilityIdentifier("onboarding.confirm")
            } else {
                Button(store.text("继续", "Continue")) { advance() }
                    .accessibilityIdentifier("onboarding.next")
            }
        }
        if (2...4).contains(step) {
            ToolbarItem(placement: .bottomBar) {
                Button(store.text("暂时跳过", "Skip for now")) { skip() }
                    .accessibilityIdentifier("onboarding.skip")
            }
        }
    }

    // MARK: - Moves

    private func sync() {
        answers.trainingDays = Double(days) ?? .nan
        answers.timeMinutes = Double(minutes) ?? .nan
        answers.sleepGoal = Double(sleep.replacingOccurrences(of: ",", with: ".")) ?? .nan
        answers.calorieTarget = calories.trimmingCharacters(in: .whitespaces).isEmpty ? nil : (Double(calories) ?? .nan)
        answers.proteinTarget = protein.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : (Double(protein.replacingOccurrences(of: ",", with: ".")) ?? .nan)
    }

    private func advance() {
        sync()
        if let refusal = Onboarding.refusal(leaving: step, answers) {
            message = store.planMessage(refusal)
            return
        }
        message = nil
        step = min(Onboarding.stepCount - 1, step + 1)
    }

    /// The website's skips: clear what the step asked, or put the sleep goal back to 8.
    private func skip() {
        switch step {
        case 2: answers.allergies = ""; answers.restrictions = ""
        case 3: sleep = "8"
        case 4: calories = ""; protein = ""
        default: break
        }
        message = nil
        step += 1
    }

    private func confirm() async {
        sync()
        saving = true
        defer { saving = false }
        if await store.completeOnboarding(answers) == false {
            message = store.planError ?? store.text("计划暂未保存，请稍后重试。填写内容仍然保留。",
                                                    "The plan was not saved. Try again; your answers are kept.")
        }
    }

    private var goalName: String {
        switch answers.goal {
        case "strength": return store.text("力量与进步", "Strength & progress")
        case "habits": return store.text("长期健康习惯", "Long-term healthy habits")
        default: return store.text("健身表现", "Fitness performance")
        }
    }

    private var nutritionSummary: String {
        let parts = [calories.isEmpty ? nil : "\(calories) kcal", protein.isEmpty ? nil : "\(protein) g"].compactMap { $0 }
        return parts.isEmpty ? store.text("暂未设置，以记录为起点", "Not set yet. Start by recording.") : parts.joined(separator: " · ")
    }

    private var template: String {
        switch answers.equipment {
        case "home": return store.text("居家全身训练：蹲、推、划船和核心，按现有器械替换动作。",
                                       "Home full-body training: squat, push, row and core, adapted to your equipment.")
        case "bodyweight": return store.text("自重基础训练：蹲、墙面或地面推、髋部动作和核心。",
                                             "Bodyweight basics: squat, wall or floor push, hip movement and core.")
        default: return store.text("全身基础训练：蹲、推、拉和核心，按你的时间安排；动作与负重由你确认。",
                                    "Full-body basics: squat, push, pull and core, fitted to your time. You choose exercises and weights.")
        }
    }

    private static func text(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }
}
