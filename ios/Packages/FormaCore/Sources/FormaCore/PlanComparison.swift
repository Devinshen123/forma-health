import Foundation

/// Listing and comparing saved plan versions.
///
/// What the website does (`src/features/Plan.tsx`, `server/validation.ts`, `server/sync.ts`):
/// - `planVersions` is an append-only array synced as one document per version
///   (`planVersions:<id>`). The service refuses deleting, editing or reordering a stored
///   version, and every new version must descend from `currentPlanId`.
/// - The history panel ("计划版本" / "Plan versions") lists versions newest first by reversing
///   storage order, numbers each "版本 N" / "Version N" by its storage position + 1, and marks the
///   current one "正在使用" / "In use".
/// - Its only before/after view is the adjustment review ("调整前" / "Before", "调整后" / "After"),
///   which shows each changed field with an arrow. A missing target reads "暂未设置" / "Not set".
/// - The fields that make up a plan are the server's `targetFields`: trainingMinutes,
///   trainingDays, sleepHours, calorieTarget, proteinTarget. id, parentId, createdAt and reason
///   are bookkeeping and never part of a difference.
///
/// Here the same before/after rule is applied between any two stored versions. A target that
/// goes from missing to set is `added`, from set to missing is `removed`, and a value that moves
/// is `changed`. Missing is never treated as zero.
public enum PlanFieldKey: String, CaseIterable, Sendable {
    // The order the website's plan page lists them in.
    case trainingDays, trainingMinutes, sleepHours, calorieTarget, proteinTarget

    public func value(in fields: PlanFields) -> Double? {
        switch self {
        case .trainingDays: return fields.trainingDays
        case .trainingMinutes: return fields.trainingMinutes
        case .sleepHours: return fields.sleepHours
        case .calorieTarget: return fields.calorieTarget
        case .proteinTarget: return fields.proteinTarget
        }
    }
}

public enum PlanChangeKind: String, Equatable, Sendable {
    case added, removed, changed
}

public struct PlanFieldChange: Equatable, Sendable {
    public let field: PlanFieldKey
    public let before: Double?
    public let after: Double?

    public init(field: PlanFieldKey, before: Double?, after: Double?) {
        self.field = field
        self.before = before
        self.after = after
    }

    public var kind: PlanChangeKind {
        switch (before, after) {
        case (nil, _): return .added
        case (_, nil): return .removed
        default: return .changed
        }
    }
}

/// A stored version with the number the website gives it.
public struct NumberedPlanVersion: Identifiable, Equatable, Sendable {
    public let number: Int
    public let version: PlanVersionView
    public let isCurrent: Bool

    public var id: String { version.id }
}

public enum PlanComparison {
    /// Every field that differs, in display order. Equal values, including both missing, are left out.
    public static func changes(from before: PlanFields, to after: PlanFields) -> [PlanFieldChange] {
        PlanFieldKey.allCases.compactMap { key in
            let old = key.value(in: before), new = key.value(in: after)
            return old == new ? nil : PlanFieldChange(field: key, before: old, after: new)
        }
    }

    /// The website's history list: newest first by storage order, numbered from 1 in storage order.
    /// Entries this build cannot read are skipped but still hold their number, so "Version N" means
    /// the same version on every device.
    public static func history(_ state: JSONValue) -> [NumberedPlanVersion] {
        let current = state["currentPlanId"].stringValue
        let raw = state["planVersions"].arrayValue ?? []
        let numbered: [NumberedPlanVersion] = raw.enumerated().compactMap { index, value in
            PlanVersionView(value).map {
                NumberedPlanVersion(number: index + 1, version: $0, isCurrent: $0.id == current)
            }
        }
        return Array(numbered.reversed())
    }

    /// The version a given version was saved from, when it is still readable.
    public static func parent(of id: String, in state: JSONValue) -> PlanVersionView? {
        let versions = PlanState.versions(state)
        guard let parentId = versions.first(where: { $0.id == id })?.parentId else { return nil }
        return versions.first { $0.id == parentId }
    }

    /// Differences between two stored versions, or nil when either is not present.
    public static func compare(_ state: JSONValue, from baseId: String, to targetId: String) -> [PlanFieldChange]? {
        let versions = PlanState.versions(state)
        guard let base = versions.first(where: { $0.id == baseId }),
              let target = versions.first(where: { $0.id == targetId }) else { return nil }
        return changes(from: base.fields, to: target.fields)
    }

    /// The default pair to compare: the current plan against the version it came from, or failing
    /// that the version saved just before it. nil when there is nothing to compare.
    public static func defaultPair(_ state: JSONValue) -> (base: String, target: String)? {
        let history = history(state)
        guard history.count > 1 else { return nil }
        let target = history.first(where: \.isCurrent) ?? history[0]
        if let parent = parent(of: target.id, in: state) { return (parent.id, target.id) }
        guard let earlier = history.first(where: { $0.number < target.number }) else {
            return history.first(where: { $0.id != target.id }).map { ($0.id, target.id) }
        }
        return (earlier.id, target.id)
    }
}
