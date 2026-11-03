import XCTest
@testable import FormaCore

final class FoodPhotoTests: XCTestCase {
    private func decode<T: Decodable>(_ json: String) throws -> T {
        try JSONDecoder().decode(T.self, from: Data(json.utf8))
    }

    func testADraftIsReadWithItsEstimateAndItsWarnings() throws {
        let draft: FoodPhotoDraft = try decode("""
        {"id":"2f1c8f6e-0a1b-4c3d-8e9f-0a1b2c3d4e5f",
         "assetId":"3a2b1c0d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
         "provider":"openai","model":"gpt-5.4-mini-2026-03-17","createdAt":"2026-11-03T00:00:00Z",
         "isFood":true,
         "items":[{"name":"Rice","grams":180,"per100g":{"kcal":130,"protein":2.4,"carbs":28,"fat":0.3}},
                  {"name":"Tofu","grams":null,"per100g":{"kcal":76,"protein":8,"carbs":1.9,"fat":4.8}}],
         "warnings":["Portion sizes are hard to judge from one photo."]}
        """)
        XCTAssertTrue(draft.isFood)
        XCTAssertEqual(draft.items.count, 2)
        XCTAssertEqual(draft.items[0].grams, 180)
        XCTAssertNil(draft.items[1].grams, "A portion the service would not guess stays unknown, not zero")
        XCTAssertEqual(draft.items[0].per100g.kcal, 130)
        XCTAssertEqual(draft.warnings.count, 1)
    }

    func testAPhotoThatIsNotFoodCarriesNoItems() throws {
        let draft: FoodPhotoDraft = try decode("""
        {"id":"2f1c8f6e-0a1b-4c3d-8e9f-0a1b2c3d4e5f","assetId":"3a2b1c0d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
         "provider":"openai","model":"m","createdAt":"2026-11-03T00:00:00Z",
         "isFood":false,"items":[],"warnings":["That does not look like food."]}
        """)
        XCTAssertFalse(draft.isFood)
        XCTAssertTrue(draft.items.isEmpty)
    }

    func testCapabilitiesSayWhetherThisDeploymentCanEstimateAtAll() throws {
        let off: ServiceCapabilities = try decode("""
        {"ai":false,"apple":false,"healthkit":false,"mode":"local",
         "foodPhoto":{"available":false,"provider":"openai","reason":"missing_api_key"}}
        """)
        XCTAssertFalse(off.ai)
        XCTAssertEqual(off.foodPhoto?.available, false)
        XCTAssertEqual(off.foodPhoto?.reason, "missing_api_key", "The service's own word for why is kept")
        // A service that says nothing about the feature is read as not offering it.
        let silent: ServiceCapabilities = try decode(#"{"apple":false}"#)
        XCTAssertFalse(silent.ai)
        XCTAssertNil(silent.foodPhoto)
    }

    func testAReviewedEstimateKeepsTheTrailBackToItsPhoto() throws {
        let asset = "3a2b1c0d-4e5f-6a7b-8c9d-0e1f2a3b4c5d", draft = "2f1c8f6e-0a1b-4c3d-8e9f-0a1b2c3d4e5f"
        let record = try NativeRecords.reviewedEstimate(
            name: "Rice", date: Date(), grams: 180, kcal: 130, protein: 2.4, carbs: 28, fat: 0.3,
            type: "lunch", assetId: asset, draftId: draft, itemIndex: 0)
        XCTAssertEqual(record["source"].stringValue, "ai_estimate",
                       "A reviewed estimate must never be filed as typed by hand")
        XCTAssertEqual(record["assetId"].stringValue, asset)
        XCTAssertEqual(record["aiDraftId"].stringValue, draft)
        XCTAssertEqual(record["aiItemIndex"].doubleValue, 0)
        // The stored numbers are per 100 g, the reference every record uses.
        XCTAssertEqual(record["referenceGrams"].doubleValue, 100)
        XCTAssertEqual(record["kcal"].doubleValue, 130)
        XCTAssertEqual(record["grams"].doubleValue, 180)
    }

    func testAnEstimateIsRefusedOnTheSameGroundsAsATypedMeal() {
        let asset = "3a2b1c0d-4e5f-6a7b-8c9d-0e1f2a3b4c5d", draft = "2f1c8f6e-0a1b-4c3d-8e9f-0a1b2c3d4e5f"
        func attempt(name: String = "Rice", grams: Double = 180, kcal: Double = 130,
                     asset: String = asset, draft: String = draft, index: Int = 0) -> Error? {
            do {
                _ = try NativeRecords.reviewedEstimate(name: name, date: Date(), grams: grams, kcal: kcal,
                                                       protein: 2.4, carbs: 28, fat: 0.3, type: "lunch",
                                                       assetId: asset, draftId: draft, itemIndex: index)
                return nil
            } catch { return error }
        }
        XCTAssertNil(attempt())
        XCTAssertEqual(attempt(name: "  ") as? NativeRecordError, .invalidName)
        XCTAssertEqual(attempt(grams: 0) as? NativeRecordError, .invalidServing)
        XCTAssertEqual(attempt(kcal: 5000) as? NativeRecordError, .invalidNutrients)
        // Without a photo and a draft to point at, it is an estimate with nothing behind it.
        XCTAssertEqual(attempt(asset: "not-a-uuid") as? NativeRecordError, .invalidAttachment)
        XCTAssertEqual(attempt(draft: "") as? NativeRecordError, .invalidAttachment)
        XCTAssertEqual(attempt(index: -1) as? NativeRecordError, .invalidAttachment)
    }
}
