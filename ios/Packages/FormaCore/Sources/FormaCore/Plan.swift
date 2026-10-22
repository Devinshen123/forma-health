import Foundation

/// Plan versions and adjustment suggestions, mirroring `src/features/Plan.tsx` and the shared
/// types. Versions are append-only: accepting or undoing adds a version, and no recorded food,
/// training or sleep fact is ever changed here.

public enum PlanError: Error, Equatable, Sendable {
    /// No current plan to build on — onboarding has not produced one yet.
    case missingCurrentPlan
    /// The plan moved while the user was editing; their edit is not applied blindly.
    case planChangedElsewhere
    case invalidValues
    case noChanges
    case suggestionUnavailable
    /// The version a suggestion was based on is no longer present, so undo has nothing to restore.
    case missingBaseVersion
}

public enum SuggestionStatus: String, Codable, CaseIterable, Sendable {
    case proposed, accepted, undone, rejected
}

/// The five values the user can edit. Missing optional targets stay missing, never zero.
public struct PlanFields: Equatable, Sendable {
    public let trainingMinutes: Double
    public let trainingDays: Double
    public let sleepHours: Double
    public let calorieTarget: Double?
    public let proteinTarget: Double?

    public init(trainingMinutes: Double, trainingDays: Double, sleepHours: Double,
                calorieTarget: Double?, proteinTarget: Double?) {
        self.trainingMinutes = trainingMinutes
        self.trainingDays = trainingDays
        self.sleepHours = sleepHours
        self.calorieTarget = calorieTarget
        self.proteinTarget = proteinTarget
    }
}

/// A suggestion only ever proposes these three values, and only some of them.
public struct PlanPatch: Equatable, Sendable {
    public let trainingMinutes: Double?
    public let trainingDays: Double?
    public let sleepHours: Double?

    public init(trainingMinutes: Double?, trainingDays: Double?, sleepHours: Double?) {
        self.trainingMinutes = trainingMinutes
        self.trainingDays = trainingDays
        self.sleepHours = sleepHours
    }

    public var isEmpty: Bool { trainingMinutes == nil && trainingDays == nil && sleepHours == nil }
}

/// A read-only view for display. The stored document keeps every field, including any this
/// build does not know, so writes are built by patching the original rather than from this.
public struct PlanVersionView: Identifiable, Equatable, Sendable {
    public let id: String
    public let parentId: String?
    public let createdAt: String
    public let reason: String
    public let fields: PlanFields

    public init?(_ value: JSONValue) {
        guard let id = value["id"].stringValue, !id.isEmpty,
              let minutes = value["trainingMinutes"].doubleValue,
              let days = value["trainingDays"].doubleValue,
              let sleep = value["sleepHours"].doubleValue else { return nil }
        self.id = id
        parentId = value["parentId"].stringValue
        createdAt = value["createdAt"].stringValue ?? ""
        reason = value["reason"].stringValue ?? ""
        fields = PlanFields(trainingMinutes: minutes, trainingDays: days, sleepHours: sleep,
                            calorieTarget: value["calorieTarget"].doubleValue,
                            proteinTarget: value["proteinTarget"].doubleValue)
    }
}

public struct SuggestionView: Identifiable, Equatable, Sendable {
    public let id: String
    public let baseVersionId: String
    public let createdAt: String
    public let reason: String
    public let status: SuggestionStatus
    public let patch: PlanPatch
    public let acceptedVersionId: String?

    public init?(_ value: JSONValue) {
        guard let id = value["id"].stringValue, !id.isEmpty,
              let base = value["baseVersionId"].stringValue,
              let status = value["status"].stringValue.flatMap(SuggestionStatus.init(rawValue:)) else { return nil }
        self.id = id
        baseVersionId = base
        createdAt = value["createdAt"].stringValue ?? ""
        reason = value["reason"].stringValue ?? ""
        self.status = status
        let fields = value["patch"]
        patch = PlanPatch(trainingMinutes: fields["trainingMinutes"].doubleValue,
                          trainingDays: fields["trainingDays"].doubleValue,
                          sleepHours: fields["sleepHours"].doubleValue)
        acceptedVersionId = value["acceptedVersionId"].stringValue
    }
}

/// One document to upsert. The caller supplies the base version from its own entity versions.
public struct PlanDocument: Equatable, Sendable {
    public let collection: String
    public let id: String
    public let value: JSONValue

    public init(collection: String, id: String, value: JSONValue) {
        self.collection = collection
        self.id = id
        self.value = value
    }
}

public enum PlanRules {
    /// Exactly the website's bounds; an out-of-range edit is refused before any request.
    public static func valid(_ fields: PlanFields) -> Bool {
        integer(fields.trainingMinutes, 10, 180)
            && integer(fields.trainingDays, 1, 7)
            && within(fields.sleepHours, 4, 12)
            && (fields.calorieTarget.map { integer($0, 500, 8000) } ?? true)
            && (fields.proteinTarget.map { within($0, 1, 400) } ?? true)
    }

    static func within(_ value: Double, _ min: Double, _ max: Double) -> Bool {
        value.isFinite && value >= min && value <= max
    }

    static func integer(_ value: Double, _ min: Double, _ max: Double) -> Bool {
        within(value, min, max) && value.rounded() == value
    }
}

public enum PlanState {
    public static func versions(_ state: JSONValue) -> [PlanVersionView] {
        (state["planVersions"].arrayValue ?? []).compactMap(PlanVersionView.init)
    }

    public static func suggestions(_ state: JSONValue) -> [SuggestionView] {
        (state["suggestions"].arrayValue ?? []).compactMap(SuggestionView.init)
    }

    public static func currentPlan(_ state: JSONValue) -> PlanVersionView? {
        guard let id = state["currentPlanId"].stringValue else { return nil }
        return versions(state).first { $0.id == id }
    }

    /// Suggestions still awaiting the user, newest first.
    public static func proposed(_ state: JSONValue) -> [SuggestionView] {
        suggestions(state).filter { $0.status == .proposed }.sorted { $0.createdAt > $1.createdAt }
    }

    /// The accepted suggestion that produced the current plan, if undo is still available.
    public static func undoableSuggestion(_ state: JSONValue) -> SuggestionView? {
        guard let plan = currentPlan(state) else { return nil }
        return suggestions(state)
            .filter { $0.status == .accepted }
            .sorted { $0.createdAt > $1.createdAt }
            .first { $0.acceptedVersionId == plan.id }
    }

    static func rawVersion(_ state: JSONValue, id: String) -> JSONValue? {
        (state["planVersions"].arrayValue ?? []).first { $0["id"].stringValue == id }
    }

    static func rawSuggestion(_ state: JSONValue, id: String) -> JSONValue? {
        (state["suggestions"].arrayValue ?? []).first { $0["id"].stringValue == id }
    }
}

public enum PlanOperations {
    /// Saves the user's own edit as a new version. Unknown fields on the base version are carried
    /// over untouched, exactly as the website's object spread does.
    public static func edit(state: JSONValue, fields: PlanFields, baseVersionId: String,
                            newId: String, now: Date = Date()) throws -> [PlanDocument] {
        guard let plan = PlanState.currentPlan(state), let raw = PlanState.rawVersion(state, id: plan.id) else {
            throw PlanError.missingCurrentPlan
        }
        guard plan.id == baseVersionId else { throw PlanError.planChangedElsewhere }
        guard PlanRules.valid(fields) else { throw PlanError.invalidValues }
        guard fields != plan.fields else { throw PlanError.noChanges }
        let next = version(from: raw, applying: fields, newId: newId, parentId: plan.id,
                           reason: "plan.user_edit", now: now)
        return documents(state: state, next: next, newId: newId, fields: fields)
    }

    /// Accepting appends a version carrying the suggestion's own reason and records which version
    /// it produced, so the decision stays auditable and undoable.
    public static func accept(state: JSONValue, suggestionId: String, newId: String,
                              now: Date = Date()) throws -> [PlanDocument] {
        guard let plan = PlanState.currentPlan(state), let raw = PlanState.rawVersion(state, id: plan.id) else {
            throw PlanError.missingCurrentPlan
        }
        guard let suggestion = PlanState.rawSuggestion(state, id: suggestionId).flatMap(SuggestionView.init),
              let rawSuggestion = PlanState.rawSuggestion(state, id: suggestionId),
              suggestion.status == .proposed else { throw PlanError.suggestionUnavailable }
        guard suggestion.baseVersionId == plan.id else { throw PlanError.planChangedElsewhere }
        let fields = apply(suggestion.patch, to: plan.fields)
        let next = version(from: raw, applying: fields, newId: newId, parentId: plan.id,
                           reason: suggestion.reason, now: now)
        var updated = rawSuggestion.objectValue ?? [:]
        updated["status"] = .string(SuggestionStatus.accepted.rawValue)
        updated["acceptedVersionId"] = .string(newId)
        return documents(state: state, next: next, newId: newId, fields: fields)
            + [PlanDocument(collection: "suggestions", id: suggestionId, value: .object(updated))]
    }

    /// Declining changes no plan and adds no version.
    public static func reject(state: JSONValue, suggestionId: String) throws -> [PlanDocument] {
        guard let raw = PlanState.rawSuggestion(state, id: suggestionId),
              SuggestionView(raw)?.status == .proposed else { throw PlanError.suggestionUnavailable }
        var updated = raw.objectValue ?? [:]
        updated["status"] = .string(SuggestionStatus.rejected.rawValue)
        return [PlanDocument(collection: "suggestions", id: suggestionId, value: .object(updated))]
    }

    /// Undo is a new restoring version, never a deletion: history and recorded facts stay intact.
    public static func undo(state: JSONValue, newId: String, now: Date = Date()) throws -> [PlanDocument] {
        guard let plan = PlanState.currentPlan(state) else { throw PlanError.missingCurrentPlan }
        guard let suggestion = PlanState.undoableSuggestion(state),
              let rawSuggestion = PlanState.rawSuggestion(state, id: suggestion.id) else {
            throw PlanError.suggestionUnavailable
        }
        guard let parentRaw = PlanState.rawVersion(state, id: suggestion.baseVersionId),
              let parent = PlanVersionView(parentRaw) else { throw PlanError.missingBaseVersion }
        let next = version(from: parentRaw, applying: parent.fields, newId: newId, parentId: plan.id,
                           reason: "suggestion.undo", now: now)
        var updated = rawSuggestion.objectValue ?? [:]
        updated["status"] = .string(SuggestionStatus.undone.rawValue)
        return documents(state: state, next: next, newId: newId, fields: parent.fields)
            + [PlanDocument(collection: "suggestions", id: suggestion.id, value: .object(updated))]
    }

    // MARK: - Building documents

    /// The new version, the pointer to it, and the profile mirror the website keeps in step.
    private static func documents(state: JSONValue, next: JSONValue, newId: String,
                                  fields: PlanFields) -> [PlanDocument] {
        var result = [
            PlanDocument(collection: "planVersions", id: newId, value: next),
            PlanDocument(collection: "currentPlanId", id: "currentPlanId", value: .string(newId)),
        ]
        if let profile = profile(state, fields: fields) {
            result.append(PlanDocument(collection: "profile", id: "profile", value: profile))
        }
        return result
    }

    private static func version(from raw: JSONValue, applying fields: PlanFields, newId: String,
                                parentId: String, reason: String, now: Date) -> JSONValue {
        var object = raw.objectValue ?? [:]
        object["id"] = .string(newId)
        object["parentId"] = .string(parentId)
        object["createdAt"] = .string(wireInstant(now))
        object["reason"] = .string(reason)
        object["trainingMinutes"] = .number(fields.trainingMinutes)
        object["trainingDays"] = .number(fields.trainingDays)
        object["sleepHours"] = .number(fields.sleepHours)
        object["calorieTarget"] = fields.calorieTarget.map(JSONValue.number) ?? .null
        object["proteinTarget"] = fields.proteinTarget.map(JSONValue.number) ?? .null
        return .object(object)
    }

    /// Only the three mirrored values change; a missing profile stays missing.
    private static func profile(_ state: JSONValue, fields: PlanFields) -> JSONValue? {
        guard var object = state["profile"].objectValue else { return nil }
        object["trainingDays"] = .number(fields.trainingDays)
        object["timeMinutes"] = .number(fields.trainingMinutes)
        object["sleepGoal"] = .number(fields.sleepHours)
        return .object(object)
    }

    public static func apply(_ patch: PlanPatch, to fields: PlanFields) -> PlanFields {
        PlanFields(trainingMinutes: patch.trainingMinutes ?? fields.trainingMinutes,
                   trainingDays: patch.trainingDays ?? fields.trainingDays,
                   sleepHours: patch.sleepHours ?? fields.sleepHours,
                   calorieTarget: fields.calorieTarget,
                   proteinTarget: fields.proteinTarget)
    }
}
