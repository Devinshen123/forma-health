import XCTest
import FormaCore
@testable import Forma

/// Synthetic only: deleting a record is refused before any request wherever it must be.
final class RecordEditStoreTests: XCTestCase {
    private static let state: JSONValue = .object([
        "meals": .array([.object(["id": .string("m1"), "name": .string("Synthetic meal")])]),
        "sleeps": .array([.object(["id": .string("s1")])]),
        "workouts": .array([.object(["id": .string("w1")])]),
        "reports": .array([.object(["id": .string("r1")])]),
    ])

    @MainActor func testTheDemoDeletesNothing() async {
        let store = AppStore(uiTesting: true)
        store.enterDemo()
        store.state = Self.state
        for (collection, id) in [("meals", "m1"), ("sleeps", "s1"), ("reports", "r1")] {
            do {
                try await store.deleteRecord(collection: collection, id: id)
                XCTFail("The demo must refuse to delete \(collection)")
            } catch {}
        }
        XCTAssertEqual(store.state, Self.state, "A refused delete changes nothing")
        XCTAssertFalse(store.hasUnconfirmedSave)
    }

    @MainActor func testOnlyMealsSleepsAndReportsCanBeDeletedHere() async {
        let store = AppStore(uiTesting: true)
        store.state = Self.state
        for collection in ["workouts", "planVersions", "profile", "suggestions"] {
            do {
                try await store.deleteRecord(collection: collection, id: "w1")
                XCTFail("\(collection) must not be deletable through the record path")
            } catch {}
        }
        XCTAssertEqual(store.state, Self.state)
    }
}

extension RecordEditStoreTests {
    /// The service deletes an original in the commit that stops referencing it, so a follow-up
    /// delete of that original is answered 404. That is the outcome asked for, not a failure.
    @MainActor func testAMissingOriginalReadsAsAlreadyGone() {
        XCTAssertTrue(AppStore.isAlreadyGone(NativeAPIError.http(404, "Attachment not found", nil)))
        XCTAssertFalse(AppStore.isAlreadyGone(NativeAPIError.http(409, "Remove this attachment from its record first", nil)),
                       "Still referenced is a real refusal")
        XCTAssertFalse(AppStore.isAlreadyGone(NativeAPIError.http(500, "", nil)))
        XCTAssertFalse(AppStore.isAlreadyGone(NativeAPIError.invalidSession))
    }
}
