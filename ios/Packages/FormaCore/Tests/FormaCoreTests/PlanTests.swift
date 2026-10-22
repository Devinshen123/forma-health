import Foundation
import XCTest
@testable import FormaCore

final class PlanTests: XCTestCase {

    // A base state with one current plan, a profile and one proposed suggestion.
    // `extra` is a field this build does not understand and must never drop.
    private func state(suggestionStatus: String = "proposed",
                       suggestionBase: String = "v1",
                       accepted: String? = nil,
                       includeProfile: Bool = true) -> JSONValue {
        var object: [String: JSONValue] = [
            "planVersions": .array([
                .object([
                    "id": .string("v0"), "parentId": .null, "createdAt": .string("2026-10-01T00:00:00.000Z"),
                    "reason": .string("plan.initial"), "trainingMinutes": .number(45), "trainingDays": .number(3),
                    "sleepHours": .number(7.5), "calorieTarget": .number(2400), "proteinTarget": .number(150),
                    "extra": .string("carried"),
                ]),
                .object([
                    "id": .string("v1"), "parentId": .string("v0"), "createdAt": .string("2026-10-10T00:00:00.000Z"),
                    "reason": .string("plan.user_edit"), "trainingMinutes": .number(60), "trainingDays": .number(4),
                    "sleepHours": .number(8), "calorieTarget": .null, "proteinTarget": .number(160),
                    "extra": .string("carried"),
                ]),
            ]),
            "currentPlanId": .string("v1"),
        ]
        var suggestion: [String: JSONValue] = [
            "id": .string("s1"), "baseVersionId": .string(suggestionBase),
            "createdAt": .string("2026-10-20T00:00:00.000Z"),
            "reason": .string("suggestion.sleep_debt"), "status": .string(suggestionStatus),
            "patch": .object(["sleepHours": .number(9), "trainingDays": .number(3)]),
            "note": .string("carried"),
        ]
        if let accepted { suggestion["acceptedVersionId"] = .string(accepted) }
        object["suggestions"] = .array([.object(suggestion)])
        if includeProfile {
            object["profile"] = .object([
                "name": .string("Synthetic"), "goal": .string("performance"),
                "trainingDays": .number(4), "timeMinutes": .number(60), "sleepGoal": .number(8),
                "allergies": .string(""), "extra": .string("carried"),
            ])
        }
        return .object(object)
    }

    private func document(_ documents: [PlanDocument], _ collection: String) -> PlanDocument? {
        documents.first { $0.collection == collection }
    }

    // MARK: - Reading

    func testCurrentPlanAndProposedSuggestionsAreReadFromState() throws {
        let value = state()
        let plan = try XCTUnwrap(PlanState.currentPlan(value))
        XCTAssertEqual(plan.id, "v1")
        XCTAssertEqual(plan.parentId, "v0")
        XCTAssertEqual(plan.fields.trainingMinutes, 60)
        XCTAssertEqual(plan.fields.trainingDays, 4)
        XCTAssertEqual(plan.fields.sleepHours, 8)
        XCTAssertNil(plan.fields.calorieTarget, "An unset target stays unset, never zero")
        XCTAssertEqual(plan.fields.proteinTarget, 160)
        XCTAssertEqual(PlanState.versions(value).map(\.id), ["v0", "v1"])
        let proposed = PlanState.proposed(value)
        XCTAssertEqual(proposed.map(\.id), ["s1"])
        XCTAssertEqual(proposed.first?.patch, PlanPatch(trainingMinutes: nil, trainingDays: 3, sleepHours: 9))
        XCTAssertEqual(proposed.first?.reason, "suggestion.sleep_debt")
    }

    func testAnUnparsableVersionOrSuggestionIsSkippedRatherThanFaked() {
        let value = JSONValue.object([
            "planVersions": .array([
                .object(["id": .string("broken"), "trainingDays": .number(3)]),
                .object(["id": .string("ok"), "trainingMinutes": .number(30), "trainingDays": .number(2), "sleepHours": .number(7)]),
            ]),
            "currentPlanId": .string("ok"),
            "suggestions": .array([
                .object(["id": .string("nostatus"), "baseVersionId": .string("ok")]),
                .object(["id": .string("badstatus"), "baseVersionId": .string("ok"), "status": .string("maybe")]),
            ]),
        ])
        XCTAssertEqual(PlanState.versions(value).map(\.id), ["ok"])
        XCTAssertEqual(PlanState.currentPlan(value)?.id, "ok")
        XCTAssertTrue(PlanState.suggestions(value).isEmpty)
    }

    func testNoCurrentPlanWhenThePointerIsMissingOrDangling() {
        XCTAssertNil(PlanState.currentPlan(.object([:])))
        var object = state().objectValue ?? [:]
        object["currentPlanId"] = .string("gone")
        XCTAssertNil(PlanState.currentPlan(.object(object)))
        object["currentPlanId"] = .null
        XCTAssertNil(PlanState.currentPlan(.object(object)))
    }

    // MARK: - Bounds

    func testEditBoundsMatchTheWebsiteExactly() {
        func fields(minutes: Double = 60, days: Double = 4, sleep: Double = 8,
                    kcal: Double? = nil, protein: Double? = nil) -> PlanFields {
            PlanFields(trainingMinutes: minutes, trainingDays: days, sleepHours: sleep,
                       calorieTarget: kcal, proteinTarget: protein)
        }
        XCTAssertTrue(PlanRules.valid(fields()))
        XCTAssertTrue(PlanRules.valid(fields(minutes: 10, days: 1, sleep: 4)))
        XCTAssertTrue(PlanRules.valid(fields(minutes: 180, days: 7, sleep: 12)))
        XCTAssertTrue(PlanRules.valid(fields(sleep: 7.5)), "Sleep may be fractional")
        XCTAssertFalse(PlanRules.valid(fields(minutes: 9)))
        XCTAssertFalse(PlanRules.valid(fields(minutes: 181)))
        XCTAssertFalse(PlanRules.valid(fields(minutes: 60.5)), "Training minutes must be whole")
        XCTAssertFalse(PlanRules.valid(fields(days: 0)))
        XCTAssertFalse(PlanRules.valid(fields(days: 8)))
        XCTAssertFalse(PlanRules.valid(fields(days: 3.5)), "Training days must be whole")
        XCTAssertFalse(PlanRules.valid(fields(sleep: 3.9)))
        XCTAssertFalse(PlanRules.valid(fields(sleep: 12.1)))
        XCTAssertTrue(PlanRules.valid(fields(kcal: 500, protein: 1)))
        XCTAssertTrue(PlanRules.valid(fields(kcal: 8000, protein: 400)))
        XCTAssertFalse(PlanRules.valid(fields(kcal: 499)))
        XCTAssertFalse(PlanRules.valid(fields(kcal: 2400.5)))
        XCTAssertFalse(PlanRules.valid(fields(protein: 0)))
        XCTAssertFalse(PlanRules.valid(fields(protein: 401)))
        XCTAssertTrue(PlanRules.valid(fields(kcal: nil, protein: nil)), "Both targets are optional")
        XCTAssertFalse(PlanRules.valid(fields(sleep: .infinity)))
        XCTAssertFalse(PlanRules.valid(fields(sleep: .nan)))
    }

    // MARK: - Editing

    func testEditAppendsAVersionAndCarriesUnknownFieldsThrough() throws {
        let value = state()
        let now = try XCTUnwrap(RecordDates.parseInstant("2026-10-22T09:00:00Z"))
        let fields = PlanFields(trainingMinutes: 50, trainingDays: 5, sleepHours: 7.5,
                                calorieTarget: 2600, proteinTarget: nil)
        let documents = try PlanOperations.edit(state: value, fields: fields, baseVersionId: "v1",
                                                newId: "v2", now: now)
        XCTAssertEqual(documents.map(\.collection), ["planVersions", "currentPlanId", "profile"])

        let version = try XCTUnwrap(document(documents, "planVersions")).value
        XCTAssertEqual(version["id"].stringValue, "v2")
        XCTAssertEqual(version["parentId"].stringValue, "v1", "The new version records what it came from")
        XCTAssertEqual(version["reason"].stringValue, "plan.user_edit")
        XCTAssertEqual(version["createdAt"].stringValue, wireInstant(now))
        XCTAssertEqual(version["trainingMinutes"].doubleValue, 50)
        XCTAssertEqual(version["trainingDays"].doubleValue, 5)
        XCTAssertEqual(version["sleepHours"].doubleValue, 7.5)
        XCTAssertEqual(version["calorieTarget"].doubleValue, 2600)
        XCTAssertEqual(version["proteinTarget"], .null, "A cleared target is null, not zero")
        XCTAssertEqual(version["extra"].stringValue, "carried",
                       "A field this build does not understand must survive the write")

        let pointer = try XCTUnwrap(document(documents, "currentPlanId"))
        XCTAssertEqual(pointer.id, "currentPlanId", "The scalar collection is keyed by its own name")
        XCTAssertEqual(pointer.value, .string("v2"))

        let profile = try XCTUnwrap(document(documents, "profile"))
        XCTAssertEqual(profile.id, "profile")
        XCTAssertEqual(profile.value["trainingDays"].doubleValue, 5)
        XCTAssertEqual(profile.value["timeMinutes"].doubleValue, 50)
        XCTAssertEqual(profile.value["sleepGoal"].doubleValue, 7.5)
        XCTAssertEqual(profile.value["name"].stringValue, "Synthetic")
        XCTAssertEqual(profile.value["extra"].stringValue, "carried")

        // The stored history is untouched; a version is added, never rewritten.
        XCTAssertEqual(PlanState.versions(value).map(\.id), ["v0", "v1"])
    }

    func testEditIsRefusedWhenTheValuesAreOutOfRangeUnchangedOrTheBaseMoved() throws {
        let value = state()
        let current = try XCTUnwrap(PlanState.currentPlan(value)).fields
        let bad = PlanFields(trainingMinutes: 5, trainingDays: 4, sleepHours: 8,
                             calorieTarget: nil, proteinTarget: 160)
        XCTAssertThrowsError(try PlanOperations.edit(state: value, fields: bad, baseVersionId: "v1", newId: "v2")) {
            XCTAssertEqual($0 as? PlanError, .invalidValues)
        }
        XCTAssertThrowsError(try PlanOperations.edit(state: value, fields: current, baseVersionId: "v1", newId: "v2")) {
            XCTAssertEqual($0 as? PlanError, .noChanges)
        }
        XCTAssertThrowsError(try PlanOperations.edit(state: value, fields: current, baseVersionId: "v0", newId: "v2")) {
            XCTAssertEqual($0 as? PlanError, .planChangedElsewhere)
        }
        XCTAssertThrowsError(try PlanOperations.edit(state: .object([:]), fields: current, baseVersionId: "v1", newId: "v2")) {
            XCTAssertEqual($0 as? PlanError, .missingCurrentPlan)
        }
    }

    func testEditWithoutAProfileWritesNoProfileDocument() throws {
        let value = state(includeProfile: false)
        let fields = PlanFields(trainingMinutes: 50, trainingDays: 5, sleepHours: 7.5,
                                calorieTarget: nil, proteinTarget: 160)
        let documents = try PlanOperations.edit(state: value, fields: fields, baseVersionId: "v1", newId: "v2")
        XCTAssertEqual(documents.map(\.collection), ["planVersions", "currentPlanId"])
    }

    // MARK: - Accepting, declining, undoing

    func testAcceptAppliesOnlyThePatchedValuesAndKeepsTheSuggestionsReason() throws {
        let value = state()
        let now = try XCTUnwrap(RecordDates.parseInstant("2026-10-22T09:00:00Z"))
        let documents = try PlanOperations.accept(state: value, suggestionId: "s1", newId: "v2", now: now)
        XCTAssertEqual(documents.map(\.collection), ["planVersions", "currentPlanId", "profile", "suggestions"])

        let version = try XCTUnwrap(document(documents, "planVersions")).value
        XCTAssertEqual(version["sleepHours"].doubleValue, 9, "Patched")
        XCTAssertEqual(version["trainingDays"].doubleValue, 3, "Patched")
        XCTAssertEqual(version["trainingMinutes"].doubleValue, 60, "Not in the patch, so carried over")
        XCTAssertEqual(version["proteinTarget"].doubleValue, 160, "A patch never touches nutrition targets")
        XCTAssertEqual(version["calorieTarget"], .null)
        XCTAssertEqual(version["reason"].stringValue, "suggestion.sleep_debt",
                       "The version carries the suggestion's own reason, not a generic one")
        XCTAssertEqual(version["parentId"].stringValue, "v1")

        let suggestion = try XCTUnwrap(document(documents, "suggestions"))
        XCTAssertEqual(suggestion.id, "s1")
        XCTAssertEqual(suggestion.value["status"].stringValue, "accepted")
        XCTAssertEqual(suggestion.value["acceptedVersionId"].stringValue, "v2",
                       "Which version it produced is recorded so undo can find it")
        XCTAssertEqual(suggestion.value["note"].stringValue, "carried")
        XCTAssertEqual(suggestion.value["patch"]["sleepHours"].doubleValue, 9, "The original patch is preserved")
    }

    func testAcceptIsRefusedOnAStaleBaseOrANonProposedSuggestion() {
        XCTAssertThrowsError(try PlanOperations.accept(state: state(suggestionBase: "v0"),
                                                      suggestionId: "s1", newId: "v2")) {
            XCTAssertEqual($0 as? PlanError, .planChangedElsewhere,
                           "A suggestion based on an older plan needs the user to look again")
        }
        for status in ["accepted", "rejected", "undone"] {
            XCTAssertThrowsError(try PlanOperations.accept(state: state(suggestionStatus: status),
                                                           suggestionId: "s1", newId: "v2")) {
                XCTAssertEqual($0 as? PlanError, .suggestionUnavailable, "status \(status)")
            }
        }
        XCTAssertThrowsError(try PlanOperations.accept(state: state(), suggestionId: "nope", newId: "v2")) {
            XCTAssertEqual($0 as? PlanError, .suggestionUnavailable)
        }
    }

    func testDecliningChangesOnlyTheSuggestionAndAddsNoVersion() throws {
        let documents = try PlanOperations.reject(state: state(), suggestionId: "s1")
        XCTAssertEqual(documents.map(\.collection), ["suggestions"])
        XCTAssertEqual(documents[0].value["status"].stringValue, "rejected")
        XCTAssertNil(documents[0].value["acceptedVersionId"].stringValue)
        // Declining a suggestion that is based on an older plan is still allowed.
        XCTAssertNoThrow(try PlanOperations.reject(state: state(suggestionBase: "v0"), suggestionId: "s1"))
        XCTAssertThrowsError(try PlanOperations.reject(state: state(suggestionStatus: "accepted"), suggestionId: "s1"))
    }

    func testUndoRestoresTheBaseValuesAsANewVersionWithoutDeletingHistory() throws {
        // v1 is the version the accepted suggestion produced, and it was based on v0.
        var object = state(suggestionStatus: "accepted", suggestionBase: "v0", accepted: "v1").objectValue ?? [:]
        object["currentPlanId"] = .string("v1")
        let value = JSONValue.object(object)
        let undoable = try XCTUnwrap(PlanState.undoableSuggestion(value))
        XCTAssertEqual(undoable.id, "s1")

        let now = try XCTUnwrap(RecordDates.parseInstant("2026-10-22T09:00:00Z"))
        let documents = try PlanOperations.undo(state: value, newId: "v2", now: now)
        XCTAssertEqual(documents.map(\.collection), ["planVersions", "currentPlanId", "profile", "suggestions"])

        let version = try XCTUnwrap(document(documents, "planVersions")).value
        XCTAssertEqual(version["id"].stringValue, "v2", "Undo adds a version; it never deletes one")
        XCTAssertEqual(version["parentId"].stringValue, "v1", "It descends from what is current now")
        XCTAssertEqual(version["reason"].stringValue, "suggestion.undo")
        XCTAssertEqual(version["trainingMinutes"].doubleValue, 45, "v0's values are restored")
        XCTAssertEqual(version["trainingDays"].doubleValue, 3)
        XCTAssertEqual(version["sleepHours"].doubleValue, 7.5)
        XCTAssertEqual(version["calorieTarget"].doubleValue, 2400)
        XCTAssertEqual(document(documents, "suggestions")?.value["status"].stringValue, "undone")
        XCTAssertEqual(PlanState.versions(value).map(\.id), ["v0", "v1"], "History is unchanged")
    }

    func testUndoIsUnavailableWithoutAnAcceptedSuggestionThatProducedTheCurrentPlan() {
        XCTAssertNil(PlanState.undoableSuggestion(state()), "A proposed suggestion is not undoable")
        // Accepted, but the plan has moved on since, so undo no longer applies.
        var object = state(suggestionStatus: "accepted", suggestionBase: "v0", accepted: "v0").objectValue ?? [:]
        object["currentPlanId"] = .string("v1")
        XCTAssertNil(PlanState.undoableSuggestion(.object(object)))
        XCTAssertThrowsError(try PlanOperations.undo(state: .object(object), newId: "v2")) {
            XCTAssertEqual($0 as? PlanError, .suggestionUnavailable)
        }
        // Accepted and current, but the version it was based on is gone.
        var orphan = state(suggestionStatus: "accepted", suggestionBase: "missing", accepted: "v1").objectValue ?? [:]
        orphan["currentPlanId"] = .string("v1")
        XCTAssertThrowsError(try PlanOperations.undo(state: .object(orphan), newId: "v2")) {
            XCTAssertEqual($0 as? PlanError, .missingBaseVersion)
        }
    }

    func testAPatchOnlyOverridesTheValuesItCarries() {
        let base = PlanFields(trainingMinutes: 60, trainingDays: 4, sleepHours: 8,
                              calorieTarget: 2400, proteinTarget: 160)
        let empty = PlanOperations.apply(PlanPatch(trainingMinutes: nil, trainingDays: nil, sleepHours: nil), to: base)
        XCTAssertEqual(empty, base)
        let partial = PlanOperations.apply(PlanPatch(trainingMinutes: nil, trainingDays: 2, sleepHours: nil), to: base)
        XCTAssertEqual(partial.trainingDays, 2)
        XCTAssertEqual(partial.trainingMinutes, 60)
        XCTAssertEqual(partial.sleepHours, 8)
        XCTAssertEqual(partial.calorieTarget, 2400, "A patch never reaches nutrition targets")
        XCTAssertEqual(partial.proteinTarget, 160)
        XCTAssertTrue(PlanPatch(trainingMinutes: nil, trainingDays: nil, sleepHours: nil).isEmpty)
        XCTAssertFalse(PlanPatch(trainingMinutes: 30, trainingDays: nil, sleepHours: nil).isEmpty)
    }
}
