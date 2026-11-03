import Foundation

/// Mirrors `src/features/Onboarding.tsx`: the six steps that give a new account its profile
/// and its first plan. The bounds are the plan's own (`PlanRules`) and the profile is exactly
/// the fourteen fields the service's strict schema accepts - one more and the save is refused.
public struct OnboardingAnswers: Equatable, Sendable {
    public var name: String
    public var goal: String
    public var experience: String
    public var trainingDays: Double
    public var timeMinutes: Double
    public var equipment: String
    public var allergies: String
    public var restrictions: String
    public var sleepGoal: Double
    /// Optional, as on the website: a target left blank is no target, never zero.
    public var calorieTarget: Double?
    public var proteinTarget: Double?

    public init(name: String = "", goal: String = "performance", experience: String = "new",
                trainingDays: Double = 3, timeMinutes: Double = 45, equipment: String = "gym",
                allergies: String = "", restrictions: String = "", sleepGoal: Double = 8,
                calorieTarget: Double? = nil, proteinTarget: Double? = nil) {
        self.name = name
        self.goal = goal
        self.experience = experience
        self.trainingDays = trainingDays
        self.timeMinutes = timeMinutes
        self.equipment = equipment
        self.allergies = allergies
        self.restrictions = restrictions
        self.sleepGoal = sleepGoal
        self.calorieTarget = calorieTarget
        self.proteinTarget = proteinTarget
    }

    /// The website's starting values, taken from an existing profile where there is one.
    public init(profile: JSONValue) {
        self.init()
        if let value = profile["name"].stringValue { name = value }
        if let value = profile["goal"].stringValue, Onboarding.goals.contains(value) { goal = value }
        if let value = profile["experience"].stringValue, Onboarding.experiences.contains(value) { experience = value }
        if let value = profile["trainingDays"].doubleValue { trainingDays = value }
        if let value = profile["timeMinutes"].doubleValue { timeMinutes = value }
        if let value = profile["equipment"].stringValue, Onboarding.equipment.contains(value) { equipment = value }
        if let value = profile["allergies"].stringValue { allergies = value }
        if let value = profile["restrictions"].stringValue { restrictions = value }
        if let value = profile["sleepGoal"].doubleValue { sleepGoal = value }
    }
}

public enum OnboardingError: Error, Equatable, Sendable {
    /// Step 2: training days 1-7 and minutes 10-180, both whole numbers.
    case invalidTraining
    /// Step 4: sleep 4-12 hours.
    case invalidSleep
    /// Step 5: a target that is given must be in range; a blank one is fine.
    case invalidNutrition
    case invalidChoice
    case textTooLong
    case invalidTimezone
}

public enum Onboarding {
    public static let goals = ["performance", "strength", "habits"]
    public static let experiences = ["new", "regular"]
    public static let equipment = ["gym", "home", "bodyweight"]
    public static let stepCount = 6

    /// The website shows onboarding to a signed-in account that has no profile yet.
    public static func needed(_ state: JSONValue) -> Bool {
        switch state["profile"] {
        case .object: return false
        default: return true
        }
    }

    /// The refusal for leaving `step` (0-based), or nil when it may be left. Only the steps the
    /// website checks are checked, with the website's messages' meaning.
    public static func refusal(leaving step: Int, _ answers: OnboardingAnswers) -> OnboardingError? {
        switch step {
        case 0:
            guard goals.contains(answers.goal) else { return .invalidChoice }
            return answers.name.count <= 160 ? nil : .textTooLong
        case 1:
            guard experiences.contains(answers.experience), equipment.contains(answers.equipment) else {
                return .invalidChoice
            }
            return PlanRules.integer(answers.trainingDays, 1, 7) && PlanRules.integer(answers.timeMinutes, 10, 180)
                ? nil : .invalidTraining
        case 2:
            return answers.allergies.count <= 2000 && answers.restrictions.count <= 2000 ? nil : .textTooLong
        case 3:
            return PlanRules.within(answers.sleepGoal, 4, 12) ? nil : .invalidSleep
        case 4:
            if let calories = answers.calorieTarget, !PlanRules.integer(calories, 500, 8000) { return .invalidNutrition }
            if let protein = answers.proteinTarget, !PlanRules.within(protein, 1, 400) { return .invalidNutrition }
            return nil
        default:
            return nil
        }
    }

    /// The documents confirming the plan writes: a first plan version, the pointer to it and the
    /// profile. Settings a profile already carries - units, time zone, consents - are kept, never
    /// reset by answering the questions again.
    public static func documents(state: JSONValue, answers: OnboardingAnswers, accountName: String?,
                                 language: String, timezone: String, newId: String,
                                 now: Date = Date()) throws -> [PlanDocument] {
        for step in 0..<(stepCount - 1) {
            if let refusal = refusal(leaving: step, answers) { throw refusal }
        }
        guard ["zh", "en"].contains(language) else { throw OnboardingError.invalidChoice }
        let existing = state["profile"].objectValue ?? [:]
        let zone = existing["timezone"]?.stringValue ?? timezone
        guard TimeZone(identifier: zone) != nil else { throw OnboardingError.invalidTimezone }

        let typed = answers.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallback = (accountName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let name = typed.isEmpty ? (fallback.isEmpty ? "Forma user" : String(fallback.prefix(160))) : typed

        let profile: JSONValue = .object([
            "name": .string(name),
            "goal": .string(answers.goal),
            "experience": .string(answers.experience),
            "trainingDays": .number(answers.trainingDays),
            "timeMinutes": .number(answers.timeMinutes),
            "equipment": .string(answers.equipment),
            "allergies": .string(answers.allergies.trimmingCharacters(in: .whitespacesAndNewlines)),
            "restrictions": .string(answers.restrictions.trimmingCharacters(in: .whitespacesAndNewlines)),
            "language": .string(language),
            "units": .string(existing["units"]?.stringValue ?? "metric"),
            "timezone": .string(zone),
            "sleepGoal": .number(answers.sleepGoal),
            "cloudConsent": .bool(existing["cloudConsent"]?.boolValue ?? false),
            "aiConsent": .bool(existing["aiConsent"]?.boolValue ?? false),
        ])
        let plan: JSONValue = .object([
            "id": .string(newId),
            "parentId": PlanState.currentPlan(state).map { .string($0.id) } ?? .null,
            "createdAt": .string(wireInstant(now)),
            "reason": .string("onboarding.initial"),
            "trainingMinutes": .number(answers.timeMinutes),
            "trainingDays": .number(answers.trainingDays),
            "sleepHours": .number(answers.sleepGoal),
            "calorieTarget": answers.calorieTarget.map(JSONValue.number) ?? .null,
            "proteinTarget": answers.proteinTarget.map(JSONValue.number) ?? .null,
        ])
        return [
            PlanDocument(collection: "planVersions", id: newId, value: plan),
            PlanDocument(collection: "currentPlanId", id: "currentPlanId", value: .string(newId)),
            PlanDocument(collection: "profile", id: "profile", value: profile),
        ]
    }
}
