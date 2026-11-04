import Foundation
import XCTest
@testable import FormaCore

/// Synthetic plan histories only; no account or recorded health fact is involved.
final class PlanComparisonTests: XCTestCase {

    private func version(_ id: String, parent: String?, minutes: Double, days: Double, sleep: Double,
                         kcal: Double?, protein: Double?, reason: String = "plan.user_edit",
                         createdAt: String = "2026-10-01T00:00:00.000Z") -> JSONValue {
        .object([
            "id": .string(id), "parentId": parent.map(JSONValue.string) ?? .null,
            "createdAt": .string(createdAt), "reason": .string(reason),
            "trainingMinutes": .number(minutes), "trainingDays": .number(days), "sleepHours": .number(sleep),
            "calorieTarget": kcal.map(JSONValue.number) ?? .null,
            "proteinTarget": protein.map(JSONValue.number) ?? .null,
        ])
    }

    /// Four versions in storage order: start, edit adding a target, accepted shortening, undo.
    private func state(current: String = "v4") -> JSONValue {
        .object([
            "planVersions": .array([
                version("v1", parent: nil, minutes: 45, days: 3, sleep: 8, kcal: nil, protein: 150,
                        reason: "onboarding.initial"),
                version("v2", parent: "v1", minutes: 60, days: 4, sleep: 8, kcal: 2400, protein: 150),
                version("v3", parent: "v2", minutes: 30, days: 4, sleep: 8, kcal: 2400, protein: 150,
                        reason: "suggestion.time_limited"),
                version("v4", parent: "v3", minutes: 60, days: 4, sleep: 8, kcal: 2400, protein: 150,
                        reason: "suggestion.undo"),
            ]),
            "currentPlanId": .string(current),
        ])
    }

    private func fields(_ minutes: Double, _ days: Double, _ sleep: Double,
                        _ kcal: Double?, _ protein: Double?) -> PlanFields {
        PlanFields(trainingMinutes: minutes, trainingDays: days, sleepHours: sleep,
                   calorieTarget: kcal, proteinTarget: protein)
    }

    // MARK: - Field differences

    func testIdenticalPlansHaveNoDifferences() {
        let plan = fields(45, 3, 8, nil, 150)
        XCTAssertEqual(PlanComparison.changes(from: plan, to: plan), [])
    }

    func testChangedAddedAndRemovedAreToldApartAndListedInPageOrder() {
        let before = fields(45, 3, 8, nil, 150)
        let after = fields(30, 3, 7.5, 2400, nil)
        let changes = PlanComparison.changes(from: before, to: after)
        XCTAssertEqual(changes.map(\.field), [.trainingMinutes, .sleepHours, .calorieTarget, .proteinTarget])
        XCTAssertEqual(changes.map(\.kind), [.changed, .changed, .added, .removed])
        XCTAssertEqual(changes[0].before, 45)
        XCTAssertEqual(changes[0].after, 30)
        XCTAssertNil(changes[2].before, "A target that was not set is missing, not zero")
        XCTAssertEqual(changes[2].after, 2400)
        XCTAssertEqual(changes[3].before, 150)
        XCTAssertNil(changes[3].after)
    }

    func testTwoMissingTargetsAreNotADifference() {
        let changes = PlanComparison.changes(from: fields(45, 3, 8, nil, nil), to: fields(45, 4, 8, nil, nil))
        XCTAssertEqual(changes, [PlanFieldChange(field: .trainingDays, before: 3, after: 4)])
    }

    func testAZeroTargetIsStillDifferentFromAMissingOne() {
        let changes = PlanComparison.changes(from: fields(45, 3, 8, nil, nil), to: fields(45, 3, 8, nil, 0))
        XCTAssertEqual(changes.map(\.kind), [.added])
    }

    func testEveryServerTargetFieldIsCompared() {
        XCTAssertEqual(Set(PlanFieldKey.allCases.map(\.rawValue)),
                       ["trainingMinutes", "trainingDays", "sleepHours", "calorieTarget", "proteinTarget"])
    }

    // MARK: - History as the website lists it

    func testHistoryIsNewestFirstAndNumberedByStorageOrder() {
        let history = PlanComparison.history(state())
        XCTAssertEqual(history.map(\.id), ["v4", "v3", "v2", "v1"])
        XCTAssertEqual(history.map(\.number), [4, 3, 2, 1])
        XCTAssertEqual(history.filter(\.isCurrent).map(\.id), ["v4"])
    }

    func testStorageOrderWinsOverTimestampsForNumbering() {
        let value: JSONValue = .object([
            "planVersions": .array([
                version("a", parent: nil, minutes: 45, days: 3, sleep: 8, kcal: nil, protein: nil,
                        createdAt: "2026-10-05T00:00:00.000Z"),
                version("b", parent: "a", minutes: 50, days: 3, sleep: 8, kcal: nil, protein: nil,
                        createdAt: "2026-10-01T00:00:00.000Z"),
            ]),
            "currentPlanId": .string("b"),
        ])
        XCTAssertEqual(PlanComparison.history(value).map(\.id), ["b", "a"])
    }

    func testAnUnreadableVersionKeepsTheOthersNumbersStable() {
        let value: JSONValue = .object([
            "planVersions": .array([
                version("a", parent: nil, minutes: 45, days: 3, sleep: 8, kcal: nil, protein: nil),
                .object(["id": .string("broken")]),
                version("c", parent: "broken", minutes: 50, days: 3, sleep: 8, kcal: nil, protein: nil),
            ]),
            "currentPlanId": .string("c"),
        ])
        let history = PlanComparison.history(value)
        XCTAssertEqual(history.map(\.id), ["c", "a"])
        XCTAssertEqual(history.map(\.number), [3, 1])
    }

    func testAnEmptyStateHasNoHistoryAndNothingToCompare() {
        XCTAssertTrue(PlanComparison.history(.object([:])).isEmpty)
        XCTAssertNil(PlanComparison.defaultPair(.object([:])))
    }

    func testASingleVersionHasNothingToCompare() {
        let value: JSONValue = .object([
            "planVersions": .array([version("a", parent: nil, minutes: 45, days: 3, sleep: 8, kcal: nil, protein: nil)]),
            "currentPlanId": .string("a"),
        ])
        XCTAssertNil(PlanComparison.defaultPair(value))
    }

    // MARK: - Comparing two stored versions

    func testTheDefaultPairIsTheCurrentPlanAndItsParent() throws {
        let pair = try XCTUnwrap(PlanComparison.defaultPair(state()))
        XCTAssertEqual(pair.base, "v3")
        XCTAssertEqual(pair.target, "v4")
        let pairForOlderCurrent = try XCTUnwrap(PlanComparison.defaultPair(state(current: "v2")))
        XCTAssertEqual(pairForOlderCurrent.base, "v1")
        XCTAssertEqual(pairForOlderCurrent.target, "v2")
    }

    func testTheDefaultPairFallsBackToTheEarlierStoredVersionWithoutAParent() throws {
        let value: JSONValue = .object([
            "planVersions": .array([
                version("a", parent: nil, minutes: 45, days: 3, sleep: 8, kcal: nil, protein: nil),
                version("b", parent: nil, minutes: 50, days: 3, sleep: 8, kcal: nil, protein: nil),
            ]),
            "currentPlanId": .string("b"),
        ])
        let pair = try XCTUnwrap(PlanComparison.defaultPair(value))
        XCTAssertEqual(pair.base, "a")
        XCTAssertEqual(pair.target, "b")
    }

    func testAnyTwoVersionsCanBeComparedInEitherDirection() throws {
        let forward = try XCTUnwrap(PlanComparison.compare(state(), from: "v1", to: "v3"))
        XCTAssertEqual(forward, [
            PlanFieldChange(field: .trainingDays, before: 3, after: 4),
            PlanFieldChange(field: .trainingMinutes, before: 45, after: 30),
            PlanFieldChange(field: .calorieTarget, before: nil, after: 2400),
        ])
        let backward = try XCTUnwrap(PlanComparison.compare(state(), from: "v3", to: "v1"))
        XCTAssertEqual(backward.map(\.kind), [.changed, .changed, .removed])
    }

    func testAnUndoRestoresTheValuesBeforeTheAdjustment() throws {
        XCTAssertEqual(PlanComparison.compare(state(), from: "v2", to: "v4"), [],
                       "An undo version restores every target of the adjustment's base")
    }

    func testAMissingVersionIsNotComparedAgainstAnInventedOne() {
        XCTAssertNil(PlanComparison.compare(state(), from: "v1", to: "gone"))
        XCTAssertNil(PlanComparison.compare(state(), from: "gone", to: "v1"))
        XCTAssertNil(PlanComparison.parent(of: "v1", in: state()), "The first version has no parent")
        XCTAssertEqual(PlanComparison.parent(of: "v3", in: state())?.id, "v2")
    }

    func testComparingReadsWithoutChangingState() {
        let value = state()
        _ = PlanComparison.history(value)
        _ = PlanComparison.compare(value, from: "v1", to: "v4")
        _ = PlanComparison.defaultPair(value)
        XCTAssertEqual(value, state())
    }
}
