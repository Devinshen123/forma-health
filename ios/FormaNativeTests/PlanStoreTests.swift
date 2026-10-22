import XCTest
import FormaCore
@testable import Forma

/// Synthetic only: a state set directly on an isolated store, plus pure mutation assembly.
/// No account, Keychain or deployed service is involved.
final class PlanStoreTests: XCTestCase {

    private static let planState: JSONValue = .object([
        "planVersions": .array([
            .object([
                "id": .string("v1"), "parentId": .null, "createdAt": .string("2026-10-10T00:00:00.000Z"),
                "reason": .string("onboarding.initial"), "trainingMinutes": .number(60),
                "trainingDays": .number(4), "sleepHours": .number(8),
                "calorieTarget": .null, "proteinTarget": .number(160),
            ]),
        ]),
        "currentPlanId": .string("v1"),
        "suggestions": .array([
            .object([
                "id": .string("s1"), "baseVersionId": .string("v1"),
                "createdAt": .string("2026-10-20T00:00:00.000Z"),
                "reason": .string("suggestion.time_limited"), "status": .string("proposed"),
                "patch": .object(["trainingMinutes": .number(30)]),
            ]),
        ]),
        "profile": .object(["name": .string("Synthetic"), "trainingDays": .number(4),
                            "timeMinutes": .number(60), "sleepGoal": .number(8)]),
    ])

    @MainActor private func makeStore(demo: Bool) -> AppStore {
        let store = AppStore(uiTesting: true)
        if demo { store.enterDemo() }
        store.state = Self.planState
        return store
    }

    // MARK: - Reading the plan out of state

    @MainActor func testTheStoreReadsTheCurrentPlanSuggestionsAndHistory() throws {
        let store = makeStore(demo: false)
        let plan = try XCTUnwrap(store.currentPlan)
        XCTAssertEqual(plan.id, "v1")
        XCTAssertEqual(plan.fields.trainingMinutes, 60)
        XCTAssertNil(plan.fields.calorieTarget, "An unset target stays unset")
        XCTAssertEqual(store.planVersions.map(\.id), ["v1"])
        XCTAssertEqual(store.proposedSuggestions.map(\.id), ["s1"])
        XCTAssertNil(store.undoableSuggestion, "A proposed suggestion is not undoable")
        XCTAssertFalse(store.hasUnconfirmedPlanSave)
    }

    @MainActor func testAnEmptyStateHasNoPlanRatherThanAZeroedOne() {
        let store = AppStore(uiTesting: true)
        XCTAssertNil(store.currentPlan)
        XCTAssertTrue(store.planVersions.isEmpty)
        XCTAssertTrue(store.proposedSuggestions.isEmpty)
        XCTAssertNil(store.undoableSuggestion)
    }

    // MARK: - A demo never writes a plan

    @MainActor func testDemoRefusesEveryPlanWriteAndChangesNothing() async {
        let store = makeStore(demo: true)
        let before = store.state
        let fields = PlanFields(trainingMinutes: 50, trainingDays: 5, sleepHours: 7,
                                calorieTarget: nil, proteinTarget: nil)
        await store.editPlan(fields)
        XCTAssertEqual(store.state, before)
        XCTAssertNotNil(store.planError)
        XCTAssertTrue(store.planError?.contains("演示") ?? false)
        XCTAssertFalse(store.hasUnconfirmedPlanSave, "A refused demo write leaves nothing unconfirmed")

        for write in ["accept", "reject", "undo"] {
            store.planError = nil
            switch write {
            case "accept": await store.acceptSuggestion("s1")
            case "reject": await store.rejectSuggestion("s1")
            default: await store.undoSuggestion()
            }
            XCTAssertEqual(store.state, before, "\(write) changed demo state")
            XCTAssertNotNil(store.planError, "\(write) gave no explanation")
            XCTAssertFalse(store.hasUnconfirmedPlanSave)
        }
    }

    // MARK: - Mutation assembly

    @MainActor func testEachChangeCarriesTheBaseVersionThisClientLastSaw() throws {
        let documents = [
            PlanDocument(collection: "planVersions", id: "v2", value: .object(["id": .string("v2")])),
            PlanDocument(collection: "currentPlanId", id: "currentPlanId", value: .string("v2")),
            PlanDocument(collection: "suggestions", id: "s1", value: .object(["id": .string("s1")])),
            PlanDocument(collection: "profile", id: "profile", value: .object(["name": .string("Synthetic")])),
        ]
        let versions = ["currentPlanId:currentPlanId": 7, "suggestions:s1": 3, "profile:profile": 11]
        let mutation = AppStore.planMutation(documents: documents, versions: versions,
                                             mutationId: "synthetic-mutation")

        XCTAssertEqual(mutation["mutationId"].stringValue, "synthetic-mutation")
        let changes = try XCTUnwrap(mutation["changes"].arrayValue)
        XCTAssertEqual(changes.count, 4, "All four documents travel in one atomic mutation")
        XCTAssertEqual(changes.map { $0["collection"].stringValue },
                       ["planVersions", "currentPlanId", "suggestions", "profile"])
        XCTAssertTrue(changes.allSatisfy { $0["kind"].stringValue == "upsert" })

        // A brand-new version has never been seen, so it must not exist yet on the service.
        XCTAssertEqual(changes[0]["baseVersion"].doubleValue, 0)
        XCTAssertEqual(changes[0]["id"].stringValue, "v2")
        // The scalar pointer is keyed by its own collection name, exactly as the service expects.
        XCTAssertEqual(changes[1]["id"].stringValue, "currentPlanId")
        XCTAssertEqual(changes[1]["baseVersion"].doubleValue, 7)
        XCTAssertEqual(changes[1]["value"], .string("v2"))
        XCTAssertEqual(changes[2]["baseVersion"].doubleValue, 3)
        XCTAssertEqual(changes[3]["baseVersion"].doubleValue, 11)
        XCTAssertEqual(changes[3]["id"].stringValue, "profile")
    }

    @MainActor func testOnlyPlanCollectionsMayBeWrittenThroughThisPath() {
        XCTAssertEqual(AppStore.planCollections, ["planVersions", "currentPlanId", "suggestions", "profile"])
        for forbidden in ["meals", "workouts", "sleeps", "reports", "activeWorkouts", "completedActions"] {
            XCTAssertFalse(AppStore.planCollections.contains(forbidden),
                           "\(forbidden) must never be written by a plan change")
        }
    }

    // MARK: - Refusals read as something a person can act on

    @MainActor func testEveryPlanRefusalGetsItsOwnReadableMessage() {
        let store = AppStore(uiTesting: true)
        let errors: [Error] = [
            PlanError.missingCurrentPlan, PlanError.planChangedElsewhere, PlanError.invalidValues,
            PlanError.noChanges, PlanError.suggestionUnavailable, PlanError.missingBaseVersion,
        ]
        var seen = Set<String>()
        for error in errors {
            let message = store.planMessage(error)
            XCTAssertFalse(message.isEmpty)
            XCTAssertFalse(message.contains("PlanError"), "A raw error name must not reach the user")
            XCTAssertTrue(seen.insert(message).inserted, "\(error) reuses another refusal's wording")
        }
        // A service conflict says the plan moved and that nothing was saved.
        let conflict = store.planMessage(NativeAPIError.http(409, "SYNC_CONFLICT", nil))
        XCTAssertFalse(conflict.isEmpty)
        XCTAssertFalse(conflict.contains("SYNC_CONFLICT"))
        XCTAssertEqual(store.planMessage(NativeAPIError.http(401, nil, nil)),
                       store.message(NativeAPIError.http(401, nil, nil)))
    }

    // MARK: - The editor reads what the user typed, not a guess

    @MainActor func testTheEditorKeepsBlankTargetsBlankAndRefusesUnusableText() throws {
        let plan = try XCTUnwrap(PlanVersionView(Self.planState["planVersions"][0]))
        var editor = PlanEditorFields(plan: plan)
        XCTAssertEqual(editor.trainingMinutes, "60")
        XCTAssertEqual(editor.trainingDays, "4")
        XCTAssertEqual(editor.sleepHours, "8")
        XCTAssertEqual(editor.calorieTarget, "", "A target that was never set stays blank, not 0")
        XCTAssertEqual(editor.proteinTarget, "160")

        let parsed = try XCTUnwrap(editor.fields)
        XCTAssertEqual(parsed.trainingMinutes, 60)
        XCTAssertNil(parsed.calorieTarget)
        XCTAssertEqual(parsed.proteinTarget, 160)

        editor.proteinTarget = "  "
        XCTAssertNil(try XCTUnwrap(editor.fields).proteinTarget, "Clearing a target removes it")

        editor.proteinTarget = "not a number"
        XCTAssertNil(editor.fields, "Unusable text is refused rather than read as 0")

        editor.proteinTarget = "160"
        editor.sleepHours = ""
        XCTAssertNil(editor.fields, "A required value cannot be blank")

        editor.sleepHours = "7,5"
        XCTAssertEqual(try XCTUnwrap(editor.fields).sleepHours, 7.5, "A comma decimal is accepted")

        editor.sleepHours = "7.5"
        XCTAssertTrue(PlanRules.valid(try XCTUnwrap(editor.fields)))
        editor.sleepHours = "20"
        XCTAssertFalse(PlanRules.valid(try XCTUnwrap(editor.fields)), "Out-of-range values stay refused")
    }

    @MainActor func testEditorTextShowsWholeNumbersWithoutADecimalTail() {
        XCTAssertEqual(PlanEditorFields.text(60), "60")
        XCTAssertEqual(PlanEditorFields.text(7.5), "7.5")
        XCTAssertEqual(PlanEditorFields.text(nil), "")
        XCTAssertEqual(PlanEditorFields.text(.nan), "")
        XCTAssertEqual(PlanEditorFields.text(.infinity), "")
    }
}
