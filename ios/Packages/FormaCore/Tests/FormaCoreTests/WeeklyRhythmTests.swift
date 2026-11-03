import XCTest
@testable import FormaCore

final class WeeklyRhythmTests: XCTestCase {
    private let utc = TimeZone(identifier: "UTC")!
    private func date(_ day: String) -> Date {
        ISO8601DateFormatter().date(from: day + "T12:00:00Z")!
    }

    func testTheWeekIsTheSevenDaysEndingTodayOldestFirst() {
        let rhythm = Metrics.weeklyRhythm(state: .object([:]), today: date("2026-11-03"), timeZone: utc)
        XCTAssertEqual(rhythm.days.map(\.day), ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31",
                                                "2026-11-01", "2026-11-02", "2026-11-03"],
                       "A rolling week, crossing the month as the website's does")
    }

    func testADayWithoutAWorkoutIsUnknownNotZero() {
        let state: JSONValue = .object([
            "workouts": .array([
                .object(["date": .string("2026-11-03"), "duration": .number(30)]),
                .object(["date": .string("2026-11-03"), "duration": .number(15)]),
                .object(["date": .string("2026-11-01"), "duration": .number(60)]),
                .object(["date": .string("2026-10-20"), "duration": .number(90)]),
            ]),
            "meals": .array([
                .object(["date": .string("2026-11-03"), "grams": .number(100), "referenceGrams": .number(100),
                         "kcal": .number(100), "protein": .number(1), "carbs": .number(1), "fat": .number(1)]),
                .object(["date": .string("2026-11-03"), "grams": .number(50), "referenceGrams": .number(100),
                         "kcal": .number(100), "protein": .number(1), "carbs": .number(1), "fat": .number(1)]),
                .object(["date": .string("2026-10-30"), "grams": .number(50), "referenceGrams": .number(100),
                         "kcal": .number(100), "protein": .number(1), "carbs": .number(1), "fat": .number(1)]),
            ]),
        ])
        let rhythm = Metrics.weeklyRhythm(state: state, today: date("2026-11-03"), timeZone: utc)
        XCTAssertEqual(rhythm.days.last?.trainingMinutes, 45, "Two workouts on one day add up")
        XCTAssertEqual(rhythm.days[4].trainingMinutes, 60)
        XCTAssertNil(rhythm.days[0].trainingMinutes, "An empty day stays unknown, never a zero")
        XCTAssertEqual(rhythm.workouts, 3, "A workout from before the week does not count")
        XCTAssertEqual(rhythm.mealDays, 2, "Days with food, not meals: two meals on one day is one day")
    }
}
