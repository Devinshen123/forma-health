import XCTest
@testable import FormaCore

final class RecordEditTests: XCTestCase {
    func testAnEditKeepsTheRecordsIdentityAndTakesTheNewValues() throws {
        let original = try NativeRecords.meal(name: "Rice", date: Date(), grams: 150, kcal: 130,
                                              protein: 2.4, carbs: 28, fat: 0.3, type: "lunch")
        let fresh = try NativeRecords.meal(name: "Brown rice", date: Date(), grams: 200, kcal: 112,
                                           protein: 2.6, carbs: 24, fat: 0.9, type: "dinner")
        let edited = NativeRecords.revised(original, with: fresh)
        XCTAssertEqual(edited["id"], original["id"], "An edit is the same record, not a second one")
        XCTAssertEqual(edited["createdAt"], original["createdAt"])
        XCTAssertEqual(edited["source"].stringValue, "manual")
        XCTAssertEqual(edited["name"].stringValue, "Brown rice")
        XCTAssertEqual(edited["grams"].doubleValue, 200)
        XCTAssertEqual(edited["type"].stringValue, "dinner")
    }

    func testCorrectingAPhotoEstimateKeepsTheTrailBackToThePhoto() throws {
        let asset = "3a2b1c0d-4e5f-6a7b-8c9d-0e1f2a3b4c5d", draft = "2f1c8f6e-0a1b-4c3d-8e9f-0a1b2c3d4e5f"
        let original = try NativeRecords.reviewedEstimate(name: "Rice", date: Date(), grams: 180, kcal: 130,
                                                         protein: 2.4, carbs: 28, fat: 0.3, type: "lunch",
                                                         assetId: asset, draftId: draft, itemIndex: 1)
        let fresh = try NativeRecords.meal(name: "Rice", date: Date(), grams: 120, kcal: 130,
                                           protein: 2.4, carbs: 28, fat: 0.3, type: "lunch")
        let edited = NativeRecords.revised(original, with: fresh)
        XCTAssertEqual(edited["source"].stringValue, "ai_estimate",
                       "Correcting an estimate does not make it something typed by hand")
        XCTAssertEqual(edited["assetId"].stringValue, asset)
        XCTAssertEqual(edited["aiDraftId"].stringValue, draft)
        XCTAssertEqual(edited["aiItemIndex"].doubleValue, 1)
        XCTAssertEqual(edited["grams"].doubleValue, 120)
    }

    func testAManualRecordGainsNoProvenanceItNeverHad() throws {
        let original = try NativeRecords.meal(name: "Rice", date: Date(), grams: 150, kcal: 130,
                                              protein: 2.4, carbs: 28, fat: 0.3, type: "lunch")
        var fresh = try NativeRecords.meal(name: "Rice", date: Date(), grams: 150, kcal: 130,
                                           protein: 2.4, carbs: 28, fat: 0.3, type: "lunch").objectValue!
        fresh["assetId"] = .string("3a2b1c0d-4e5f-6a7b-8c9d-0e1f2a3b4c5d")
        let edited = NativeRecords.revised(original, with: .object(fresh))
        XCTAssertNil(edited["assetId"].stringValue)
    }

    func testAPhotoBehindAMealIsStillInUse() {
        let photo = "3a2b1c0d-4e5f-6a7b-8c9d-0e1f2a3b4c5d"
        let state: JSONValue = .object([
            "meals": .array([.object(["id": .string("m1"), "assetId": .string(photo)])]),
            "reports": .array([]),
        ])
        XCTAssertTrue(ReportState.attachmentIsReferenced(state, assetId: photo),
                      "One photo can stand behind several meals; the service counts them, so must we")
        XCTAssertFalse(ReportState.attachmentIsReferenced(state, assetId: "00000000-0000-0000-0000-000000000000"))
    }
}
