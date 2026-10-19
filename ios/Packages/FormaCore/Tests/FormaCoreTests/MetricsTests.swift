import Foundation
import XCTest
@testable import FormaCore

final class MetricsTests: XCTestCase {
    func testMealScalingUsesReferenceWeightAndKeepsUnknownSeparateFromZero() throws {
        let meal = try TestFixtures.load("meal")
        XCTAssertEqual(Metrics.mealTotals(meal), NutritionTotals(kcal: 375, protein: 30, carbs: 45, fat: 7.5))
        let otherReference = TestFixtures.replacing(meal, [
            "referenceGrams": .number(200), "grams": .number(50),
            "kcal": .number(400), "protein": .number(40), "carbs": .number(60), "fat": .number(10)
        ])
        XCTAssertEqual(Metrics.mealTotals(otherReference), NutritionTotals(kcal: 100, protein: 10, carbs: 15, fat: 2.5))
        XCTAssertNil(Metrics.mealTotals(TestFixtures.replacing(meal, ["referenceGrams": .null])))
        XCTAssertNil(Metrics.mealTotals(TestFixtures.replacing(meal, ["grams": .number(0)])))
        XCTAssertNil(Metrics.mealTotals(TestFixtures.replacing(meal, ["protein": .null])))
        let zero = TestFixtures.replacing(meal, ["kcal": .number(0), "protein": .number(0), "carbs": .number(0), "fat": .number(0)])
        XCTAssertEqual(Metrics.mealTotals(zero)?.kcal, 0)
    }

    func testEmptyStateReportsMissingMetricsAndZeroRecordedDays() {
        let empty: JSONValue = .object([:])
        let metrics = Metrics.summary(state: empty, days: ["2026-10-16", "2026-10-17", "2026-10-18"])
        XCTAssertNil(metrics.nutrition)
        XCTAssertNil(metrics.trainingMinutes)
        XCTAssertNil(metrics.sleepHours)
        XCTAssertEqual(metrics.totalDays, 3)
        XCTAssertEqual(metrics.nutritionDays, 0)
        XCTAssertEqual(metrics.trainingDays, 0)
        XCTAssertEqual(metrics.sleepDays, 0)
        let training = Metrics.trainingSummary([])
        XCTAssertEqual(training.sessions, 0)
        XCTAssertNil(training.minutes)
        XCTAssertNil(training.completedSets)
        XCTAssertNil(training.volumeKg)
    }

    func testFixtureSummaryCountsRecordedDaysWithoutFillingOtherDays() throws {
        let state: JSONValue = .object([
            "meals": .array([try TestFixtures.load("meal")]),
            "workouts": .array([try TestFixtures.load("workout")]),
            "sleeps": .array([try TestFixtures.load("sleep")]),
            "activeWorkouts": .array([.object(["date": .string("2026-10-18"), "duration": .number(999)])])
        ])
        let days = (12...18).map { "2026-10-\($0)" }
        let metrics = Metrics.summary(state: state, days: days)
        XCTAssertEqual(metrics.nutrition?.kcal, 375)
        XCTAssertEqual(metrics.trainingMinutes, 20.5)
        XCTAssertEqual(metrics.sleepHours, 7.5)
        XCTAssertEqual(metrics.totalDays, 7)
        XCTAssertEqual(metrics.nutritionDays, 1)
        XCTAssertEqual(metrics.trainingDays, 1)
        XCTAssertEqual(metrics.sleepDays, 1)
        let day = Metrics.dailySummary(state: state, date: try TestFixtures.date("2026-10-18T12:00:00Z"), timeZone: TimeZone(secondsFromGMT: 0)!)
        XCTAssertEqual(day.day, "2026-10-18")
        XCTAssertEqual(day.mealRecords, 1)
        XCTAssertEqual(day.workoutRecords, 1)
        XCTAssertEqual(day.sleepRecords, 1)
        XCTAssertEqual(day.trainingMinutes, 20.5)
    }

    func testRangesIgnoreDuplicateInvalidAndOutOfRangeDays() throws {
        let meal = try TestFixtures.load("meal")
        let state: JSONValue = .object(["meals": .array([meal])])
        let result = Metrics.summary(state: state, days: ["2026-10-18", "2026-10-18", "2026-02-30", "unknown", "2026-10-17"])
        XCTAssertEqual(result.totalDays, 2)
        XCTAssertEqual(result.nutritionDays, 1)
        XCTAssertEqual(result.nutrition?.kcal, 375)
        XCTAssertNil(Metrics.summary(state: state, days: ["2026-10-17"]).nutrition)
    }

    func testKnownZeroNutritionStillCountsAsARecordedDay() throws {
        let meal = TestFixtures.replacing(try TestFixtures.load("meal"), ["kcal": .number(0), "protein": .number(0), "carbs": .number(0), "fat": .number(0)])
        let result = Metrics.summary(state: .object(["meals": .array([meal])]), days: ["2026-10-18"])
        XCTAssertEqual(result.nutrition?.kcal, 0)
        XCTAssertEqual(result.nutritionDays, 1)
        XCTAssertNil(result.trainingMinutes)
    }

    func testLegacyTrainingDoesNotInventSetsOrVolume() throws {
        let result = Metrics.trainingSummary([try TestFixtures.load("workout")])
        XCTAssertEqual(result.sessions, 1)
        XCTAssertEqual(result.minutes, 20.5)
        XCTAssertEqual(result.detailedSessions, 0)
        XCTAssertEqual(result.summarySessions, 1)
        XCTAssertNil(result.completedSets)
        XCTAssertNil(result.volumeKg)
    }

    func testTrainingUsesActualWorkAndDropRowsAndMarksTimedVolumeUnknown() throws {
        let rows: [JSONValue] = [
            row(kind: "warmup", weight: .number(100), reps: .number(20)),
            row(weight: .number(30), reps: .number(6)),
            row(kind: "drop", weight: .number(20), reps: .number(4)),
            row(weight: .number(100), reps: .number(100), completed: false),
            row(weight: .null, reps: .null, seconds: .number(60)),
            row(weight: .number(0), reps: .number(10))
        ]
        let detailed = detailedWorkout(rows: rows, duration: .number(10))
        let result = Metrics.trainingSummary([try TestFixtures.load("workout"), detailed])
        XCTAssertEqual(result.sessions, 2)
        XCTAssertEqual(result.minutes, 30.5)
        XCTAssertEqual(result.detailedSessions, 1)
        XCTAssertEqual(result.summarySessions, 1)
        XCTAssertEqual(result.completedSets, 4)
        XCTAssertEqual(result.volumeKg, 260)
        XCTAssertEqual(result.unknownLoadSets, 1)
    }

    func testZeroAndTinyPositiveLoadRemainKnownWhileInvalidDurationsStayMissing() {
        let zero = Metrics.trainingSummary([detailedWorkout(rows: [row(weight: .number(0), reps: .number(8))], duration: .null)])
        XCTAssertEqual(zero.completedSets, 1)
        XCTAssertEqual(zero.volumeKg, 0)
        XCTAssertNil(zero.minutes)
        let tiny = Metrics.trainingSummary([detailedWorkout(rows: [row(weight: .number(0.000001), reps: .number(1))], duration: .number(0.0001))])
        XCTAssertEqual(tiny.volumeKg, 0.000001)
        XCTAssertEqual(tiny.minutes, 0.0001)
        for duration in [JSONValue.number(0), .number(-1), .number(1_441), .number(.infinity)] {
            XCTAssertNil(Metrics.trainingSummary([detailedWorkout(rows: [], duration: duration)]).minutes)
        }
    }

    func testOnlyWarmupDoesNotClaimWorkingVolumeAndInvalidRowsAreIgnored() {
        let invalid = [
            row(kind: "warmup", weight: .number(100), reps: .number(10)),
            row(weight: .null, reps: .number(10)),
            row(weight: .number(-1), reps: .number(10)),
            row(weight: .number(25), reps: .number(1.5)),
            row(kind: "unknown", weight: .number(100), reps: .number(10))
        ]
        let result = Metrics.trainingSummary([detailedWorkout(rows: invalid, duration: .number(10))])
        XCTAssertEqual(result.completedSets, 0)
        XCTAssertNil(result.volumeKg)
        XCTAssertEqual(result.unknownLoadSets, 0)
    }

    func testOverlappingSleepDoesNotDoubleCountAndInvalidWakeDayIsExcluded() throws {
        let first = try TestFixtures.load("sleep")
        let overlap = TestFixtures.replacing(first, ["start": .string("2026-10-18T07:00:00Z")])
        let separate = TestFixtures.replacing(first, ["start": .string("2026-10-18T22:00:00Z"), "end": .string("2026-10-18T23:00:00Z")])
        let wrongDay = TestFixtures.replacing(first, ["date": .string("2026-10-17")])
        let state: JSONValue = .object(["sleeps": .array([first, overlap, separate, wrongDay])])
        let result = Metrics.summary(state: state, days: ["2026-10-17", "2026-10-18"])
        XCTAssertEqual(result.sleepHours, 8.5)
        XCTAssertEqual(result.sleepDays, 1)
        let day = Metrics.dailySummary(state: state, date: try TestFixtures.date("2026-10-18T12:00:00Z"), timeZone: TimeZone(secondsFromGMT: 0)!)
        XCTAssertEqual(day.sleepRecords, 3)
    }

    private func row(kind: String = "work", weight: JSONValue, reps: JSONValue, seconds: JSONValue = .null, completed: Bool = true) -> JSONValue {
        .object(["kind": .string(kind), "weight": weight, "reps": reps, "durationSeconds": seconds, "completed": .bool(completed)])
    }

    private func detailedWorkout(rows: [JSONValue], duration: JSONValue) -> JSONValue {
        .object(["date": .string("2026-10-18"), "duration": duration, "exercises": .array([.object(["setLogs": .array(rows)])])])
    }
}
