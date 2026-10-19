import Foundation
import XCTest
@testable import FormaCore

final class NativeRecordsTests: XCTestCase {
    private func meal(grams: Double = 150, kcal: Double = 250, protein: Double = 20, carbs: Double = 30, fat: Double = 5, name: String = " Meal ", type: String = "lunch") throws -> JSONValue {
        try NativeRecords.meal(name: name, date: TestFixtures.date("2026-10-18T12:00:00Z"), grams: grams, kcal: kcal, protein: protein, carbs: carbs, fat: fat, type: type)
    }

    private func workout(duration: Double = 20.5, sets: Int = 3, reps: Int = 8, weight: Double = 25, notes: String = "Actual summary") throws -> JSONValue {
        try NativeRecords.workout(name: "Session", date: TestFixtures.date("2026-10-18T12:00:00Z"), duration: duration, exerciseName: "Row", sets: sets, reps: reps, weight: weight, notes: notes)
    }

    func testMealUsesActualServingAndPer100gReference() throws {
        let before = Date().addingTimeInterval(-1)
        let value = try meal()
        XCTAssertEqual(value["name"].stringValue, "Meal")
        XCTAssertEqual(value["grams"].doubleValue, 150)
        XCTAssertEqual(value["referenceGrams"].doubleValue, 100)
        XCTAssertEqual(value["kcal"].doubleValue, 250)
        XCTAssertEqual(value["source"].stringValue, "manual")
        XCTAssertNotNil(UUID(uuidString: try XCTUnwrap(value["id"].stringValue)))
        let createdAt = try TestFixtures.date(XCTUnwrap(value["createdAt"].stringValue))
        XCTAssertGreaterThanOrEqual(createdAt, before)
        XCTAssertLessThanOrEqual(createdAt, Date().addingTimeInterval(1))
        XCTAssertEqual(try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(value)), value)
        XCTAssertNotEqual(try meal()["id"], value["id"])
    }

    func testMealRejectsInvalidAndInconsistentNutritionWithoutClamping() throws {
        for grams in [0.0, -1, 10_001, .infinity, .nan] { XCTAssertThrowsError(try meal(grams: grams)) }
        for kcal in [-1.0, 1_201, .infinity, .nan] { XCTAssertThrowsError(try meal(kcal: kcal)) }
        XCTAssertThrowsError(try meal(protein: -1))
        XCTAssertThrowsError(try meal(protein: 100, carbs: 12, fat: 0))
        XCTAssertThrowsError(try meal(type: "unknown"))
        XCTAssertThrowsError(try meal(name: " \n "))
        XCTAssertThrowsError(try meal(name: "Hidden\u{0001}control"))
        XCTAssertThrowsError(try meal(name: String(repeating: "😀", count: 81)))
        XCTAssertNoThrow(try meal(grams: 10_000, kcal: 1_200, protein: 100, carbs: 11, fat: 0, name: String(repeating: "😀", count: 80)))
        XCTAssertNoThrow(try meal(kcal: 0, protein: 0, carbs: 0, fat: 0))
    }

    func testSleepUsesWakeDayInSpecifiedZoneAndActualElapsedDuration() throws {
        let start = try TestFixtures.date("2026-10-17T21:00:00Z")
        let end = try TestFixtures.date("2026-10-18T05:00:00Z")
        let value = try NativeRecords.sleep(start: start, end: end, quality: 4, energy: 3, timezone: "America/Los_Angeles")
        XCTAssertEqual(value["date"].stringValue, "2026-10-17")
        XCTAssertEqual(value["timezone"].stringValue, "America/Los_Angeles")
        let spring = try NativeRecords.sleep(start: TestFixtures.date("2026-03-08T09:00:00Z"), end: TestFixtures.date("2026-03-08T11:00:00Z"), quality: 3, energy: 3, timezone: "America/Los_Angeles")
        let state: JSONValue = .object(["sleeps": .array([spring])])
        XCTAssertEqual(Metrics.summary(state: state, days: ["2026-03-08"]).sleepHours, 2)
    }

    func testSleepRejectsInvalidRangeZoneAndRatings() throws {
        let start = try TestFixtures.date("2026-10-18T00:00:00Z")
        for seconds in [0.0, -1, 86_401, .infinity] {
            XCTAssertThrowsError(try NativeRecords.sleep(start: start, end: start.addingTimeInterval(seconds), quality: 3, energy: 3, timezone: "UTC"))
        }
        XCTAssertThrowsError(try NativeRecords.sleep(start: start, end: start.addingTimeInterval(1), quality: 0, energy: 3, timezone: "UTC"))
        XCTAssertThrowsError(try NativeRecords.sleep(start: start, end: start.addingTimeInterval(1), quality: 3, energy: 6, timezone: "UTC"))
        XCTAssertThrowsError(try NativeRecords.sleep(start: start, end: start.addingTimeInterval(1), quality: 3, energy: 3, timezone: "Not/A_Zone"))
        XCTAssertNoThrow(try NativeRecords.sleep(start: start, end: start.addingTimeInterval(86_400), quality: 1, energy: 5, timezone: "UTC"))
        XCTAssertThrowsError(try NativeRecords.sleep(start: start, end: start.addingTimeInterval(0.0001), quality: 3, energy: 3, timezone: "UTC"))
    }

    func testWorkoutKeepsFractionalActualDurationAndDoesNotInventSetLogs() throws {
        let value = try workout()
        XCTAssertEqual(value["duration"].doubleValue, 20.5)
        XCTAssertEqual(value["rpe"], .null)
        XCTAssertEqual(value["exercises"].arrayValue?.count, 1)
        XCTAssertEqual(value["exercises"][0]["sets"].intValue, 3)
        XCTAssertEqual(value["exercises"][0]["reps"].intValue, 8)
        XCTAssertEqual(value["exercises"][0]["weight"].doubleValue, 25)
        XCTAssertNil(value["exercises"][0].objectValue?["setLogs"])
        XCTAssertNoThrow(try workout(weight: 0))
        for duration in [0.0, -1, 1_441, .infinity, .nan] { XCTAssertThrowsError(try workout(duration: duration)) }
        for sets in [0, 101] { XCTAssertThrowsError(try workout(sets: sets)) }
        for reps in [0, 1_001] { XCTAssertThrowsError(try workout(reps: reps)) }
        for weight in [-1.0, 2_001, .infinity, .nan] { XCTAssertThrowsError(try workout(weight: weight)) }
        XCTAssertThrowsError(try workout(notes: String(repeating: "x", count: 10_001)))
        XCTAssertNoThrow(try workout(notes: String(repeating: "x", count: 10_000)))
    }

    func testFixturesHaveStableUUIDsAndFactoryContractKeys() throws {
        let fixtures = try ["meal", "sleep", "workout"].map(TestFixtures.load)
        XCTAssertEqual(Set(fixtures.compactMap { $0["id"].stringValue }).count, 3)
        for value in fixtures {
            XCTAssertNotNil(UUID(uuidString: try XCTUnwrap(value["id"].stringValue)))
            XCTAssertTrue(RecordDates.isDay(try XCTUnwrap(value["date"].stringValue)))
            XCTAssertNotNil(RecordDates.parseInstant(try XCTUnwrap(value["createdAt"].stringValue)))
        }
        XCTAssertEqual(Set(try XCTUnwrap(fixtures[0].objectValue).keys), Set(try XCTUnwrap(meal().objectValue).keys))
        XCTAssertEqual(Set(try XCTUnwrap(fixtures[2].objectValue).keys), Set(try XCTUnwrap(workout().objectValue).keys))
        let sleep = try NativeRecords.sleep(start: TestFixtures.date("2026-10-18T06:00:00Z"), end: TestFixtures.date("2026-10-18T13:30:00Z"), quality: 4, energy: 3, timezone: "America/Los_Angeles")
        XCTAssertEqual(Set(try XCTUnwrap(fixtures[1].objectValue).keys), Set(try XCTUnwrap(sleep.objectValue).keys))
    }

    func testDateValidationRejectsNonFiniteDatesAndImpossibleDays() throws {
        XCTAssertThrowsError(try NativeRecords.meal(name: "Meal", date: Date(timeIntervalSince1970: .nan), grams: 1, kcal: 0, protein: 0, carbs: 0, fat: 0, type: "snack"))
        XCTAssertTrue(RecordDates.isDay("2028-02-29"))
        XCTAssertFalse(RecordDates.isDay("2026-02-29"))
        XCTAssertFalse(RecordDates.isDay("2026-13-01"))
        XCTAssertFalse(RecordDates.isDay("2026-1-01"))
    }
}
