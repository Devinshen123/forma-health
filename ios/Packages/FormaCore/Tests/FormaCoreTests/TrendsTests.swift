import XCTest
@testable import FormaCore

/// Synthetic records only: no real person's meals, training or sleep.
final class TrendsTests: XCTestCase {
    private let utc = TimeZone(identifier: "UTC")!
    private func date(_ day: String) -> Date {
        ISO8601DateFormatter().date(from: day + "T12:00:00Z")!
    }

    private func meal(_ day: String, grams: Double, kcal: Double, name: String = "Oats", source: String = "manual") -> JSONValue {
        .object(["date": .string(day), "name": .string(name), "source": .string(source),
                 "grams": .number(grams), "referenceGrams": .number(100), "kcal": .number(kcal),
                 "protein": .number(1), "carbs": .number(1), "fat": .number(1)])
    }

    private func workout(_ day: String, minutes: Double, name: String = "Run") -> JSONValue {
        .object(["date": .string(day), "name": .string(name), "duration": .number(minutes)])
    }

    private func sleep(_ day: String, start: String, end: String) -> JSONValue {
        .object(["date": .string(day), "start": .string(start), "end": .string(end), "timezone": .string("UTC")])
    }

    func testBothRangesEndTodayOldestFirst() {
        let week = Metrics.trends(state: .object([:]), range: .week, today: date("2026-11-03"), timeZone: utc)
        XCTAssertEqual(week.days.map(\.day), ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31",
                                              "2026-11-01", "2026-11-02", "2026-11-03"])
        let fortnight = Metrics.trends(state: .object([:]), range: .fortnight, today: date("2026-11-03"), timeZone: utc)
        XCTAssertEqual(fortnight.days.count, 14)
        XCTAssertEqual(fortnight.days.first?.day, "2026-10-21")
        XCTAssertEqual(fortnight.days.last?.day, "2026-11-03")
    }

    func testAnEmptyRangeIsUnknownEverywhereNeverZero() {
        let trends = Metrics.trends(state: .object([:]), range: .week, today: date("2026-11-03"), timeZone: utc)
        for metric in TrendMetric.allCases {
            XCTAssertEqual(trends.recordedDays(metric), 0)
            XCTAssertTrue(trends.days.allSatisfy { $0.value(metric) == nil }, "No record is not a zero")
            XCTAssertEqual(trends.segments(metric), [])
            XCTAssertEqual(trends.chartMaximum(metric), 1.15, accuracy: 1e-9)
        }
        XCTAssertNil(trends.averageSleepHours)
        XCTAssertNil(trends.totalTrainingMinutes, "No training recorded is unknown, not 0 minutes")
        XCTAssertEqual(trends.mealRecords, 0)
        XCTAssertEqual(trends.daysWithAllThree, 0)
        XCTAssertFalse(trends.isComplete)
    }

    func testDailyValuesSumPerDayAndMissingDaysBreakTheLine() {
        let state: JSONValue = .object([
            "meals": .array([
                meal("2026-11-03", grams: 100, kcal: 300),
                meal("2026-11-03", grams: 50, kcal: 200, name: "Rice", source: "ai_estimate"),
                meal("2026-11-01", grams: 200, kcal: 100),
                meal("2026-10-20", grams: 100, kcal: 999),
            ]),
            "workouts": .array([
                workout("2026-11-03", minutes: 30), workout("2026-11-03", minutes: 15, name: "Lift"),
                workout("2026-10-29", minutes: 60),
            ]),
        ])
        let trends = Metrics.trends(state: state, range: .week, today: date("2026-11-03"), timeZone: utc)
        let today = trends.days[6]
        XCTAssertEqual(today.kcal, 400, "300 + half of 200")
        XCTAssertEqual(today.trainingMinutes, 45)
        XCTAssertEqual(today.mealRecords, 2)
        XCTAssertEqual(today.workoutRecords, 2)
        XCTAssertEqual(today.mealNames, ["Oats", "Rice"])
        XCTAssertEqual(today.workoutNames, ["Run", "Lift"])
        XCTAssertTrue(today.includesEstimate)
        XCTAssertFalse(trends.days[4].includesEstimate)
        XCTAssertEqual(trends.days[4].kcal, 200)
        XCTAssertNil(trends.days[5].kcal, "The day between two food days stays unknown")
        XCTAssertEqual(trends.recordedDays(.nutrition), 2)
        XCTAssertEqual(trends.recordedDays(.training), 2)
        XCTAssertEqual(trends.mealRecords, 3, "A meal from before the range does not count")
        XCTAssertEqual(trends.totalTrainingMinutes, 105)
        XCTAssertEqual(trends.segments(.nutrition), [[4], [6]], "A gap is never joined across")
        XCTAssertEqual(trends.segments(.training), [[1], [6]])
        XCTAssertEqual(trends.chartMaximum(.nutrition), 400 * 1.15, accuracy: 1e-9)
    }

    func testSleepAverageUsesRecordedDaysOnlyAndMergesOverlap() {
        let state: JSONValue = .object(["sleeps": .array([
            sleep("2026-11-03", start: "2026-11-02T23:00:00Z", end: "2026-11-03T07:00:00Z"),
            sleep("2026-11-03", start: "2026-11-03T06:00:00Z", end: "2026-11-03T07:30:00Z"),
            sleep("2026-11-01", start: "2026-10-31T23:00:00Z", end: "2026-11-01T05:00:00Z"),
        ])])
        let trends = Metrics.trends(state: state, range: .week, today: date("2026-11-03"), timeZone: utc)
        XCTAssertEqual(trends.days[6].sleepHours, 8.5, "Overlapping intervals merge, not add")
        XCTAssertEqual(trends.days[6].sleepRecords, 2)
        XCTAssertEqual(trends.recordedDays(.sleep), 2)
        XCTAssertEqual(trends.averageSleepHours!, (8.5 + 6) / 2, accuracy: 1e-9,
                       "Five empty days are excluded from the average, not counted as 0 hours")
    }

    func testCoverageCountsDaysWithAllThreeAndCompleteNeedsEveryDay() {
        var meals: [JSONValue] = [], workouts: [JSONValue] = [], sleeps: [JSONValue] = []
        let days = ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]
        for day in days {
            meals.append(meal(day, grams: 100, kcal: 500))
            workouts.append(workout(day, minutes: 20))
            sleeps.append(sleep(day, start: day + "T00:00:00Z", end: day + "T07:00:00Z"))
        }
        let full: JSONValue = .object(["meals": .array(meals), "workouts": .array(workouts), "sleeps": .array(sleeps)])
        let week = Metrics.trends(state: full, range: .week, today: date("2026-11-03"), timeZone: utc)
        XCTAssertEqual(week.daysWithAllThree, 7)
        XCTAssertTrue(week.isComplete)
        XCTAssertEqual(week.segments(.sleep), [Array(0..<7)])

        let fortnight = Metrics.trends(state: full, range: .fortnight, today: date("2026-11-03"), timeZone: utc)
        XCTAssertEqual(fortnight.daysWithAllThree, 7)
        XCTAssertFalse(fortnight.isComplete, "Seven of fourteen days is not complete")

        let partial: JSONValue = .object(["meals": .array(meals), "workouts": .array(Array(workouts.dropLast())), "sleeps": .array(sleeps)])
        let missingOne = Metrics.trends(state: partial, range: .week, today: date("2026-11-03"), timeZone: utc)
        XCTAssertEqual(missingOne.daysWithAllThree, 6)
        XCTAssertFalse(missingOne.isComplete)
    }

    func testUnusableNumbersAreUnknownButTheRecordStillCounts() {
        let state: JSONValue = .object([
            "meals": .array([meal("2026-11-03", grams: -5, kcal: 300)]),
            "workouts": .array([workout("2026-11-03", minutes: 0)]),
        ])
        let today = Metrics.trends(state: state, range: .week, today: date("2026-11-03"), timeZone: utc).days[6]
        XCTAssertNil(today.kcal)
        XCTAssertNil(today.trainingMinutes)
        XCTAssertEqual(today.mealRecords, 1, "The saved record is listed even when its numbers cannot be used")
        XCTAssertEqual(today.workoutRecords, 1)
    }

    func testTodayFollowsTheProfileTimeZone() {
        let state: JSONValue = .object(["profile": .object(["timezone": .string("Asia/Shanghai")])])
        let zone = Metrics.profileTimeZone(state: state, fallback: utc)
        XCTAssertEqual(zone.identifier, "Asia/Shanghai")
        // 20:00 UTC on 3 Nov is already 4 Nov in Shanghai.
        let late = ISO8601DateFormatter().date(from: "2026-11-03T20:00:00Z")!
        XCTAssertEqual(Metrics.trends(state: state, range: .week, today: late, timeZone: zone).days.last?.day, "2026-11-04")
        let unknown: JSONValue = .object(["profile": .object(["timezone": .string("Mars/Base")])])
        XCTAssertEqual(Metrics.profileTimeZone(state: unknown, fallback: utc), utc)
    }
}
