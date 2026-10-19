import Foundation

public struct NutritionTotals: Equatable, Sendable {
    public let kcal: Double
    public let protein: Double
    public let carbs: Double
    public let fat: Double

    public init(kcal: Double, protein: Double, carbs: Double, fat: Double) {
        self.kcal = kcal
        self.protein = protein
        self.carbs = carbs
        self.fat = fat
    }
}

public struct DayMetrics: Equatable, Sendable {
    public let day: String
    public let nutrition: NutritionTotals?
    public let trainingMinutes: Double?
    public let sleepHours: Double?
    public let mealRecords: Int
    public let workoutRecords: Int
    public let sleepRecords: Int

    public init(day: String, nutrition: NutritionTotals?, trainingMinutes: Double?, sleepHours: Double?, mealRecords: Int, workoutRecords: Int, sleepRecords: Int) {
        self.day = day
        self.nutrition = nutrition
        self.trainingMinutes = trainingMinutes
        self.sleepHours = sleepHours
        self.mealRecords = mealRecords
        self.workoutRecords = workoutRecords
        self.sleepRecords = sleepRecords
    }
}

/// Coverage counts days with usable records, not days when every meal or activity was recorded.
public struct RangeMetrics: Equatable, Sendable {
    public let nutrition: NutritionTotals?
    public let trainingMinutes: Double?
    public let sleepHours: Double?
    public let nutritionDays: Int
    public let trainingDays: Int
    public let sleepDays: Int
    public let totalDays: Int

    public init(nutrition: NutritionTotals?, trainingMinutes: Double?, sleepHours: Double?, nutritionDays: Int, trainingDays: Int, sleepDays: Int, totalDays: Int) {
        self.nutrition = nutrition
        self.trainingMinutes = trainingMinutes
        self.sleepHours = sleepHours
        self.nutritionDays = nutritionDays
        self.trainingDays = trainingDays
        self.sleepDays = sleepDays
        self.totalDays = totalDays
    }
}

public struct TrainingMetrics: Equatable, Sendable {
    public let sessions: Int
    public let minutes: Double?
    public let detailedSessions: Int
    public let summarySessions: Int
    public let completedSets: Int?
    public let volumeKg: Double?
    public let unknownLoadSets: Int

    public init(sessions: Int, minutes: Double?, detailedSessions: Int, summarySessions: Int, completedSets: Int?, volumeKg: Double?, unknownLoadSets: Int) {
        self.sessions = sessions
        self.minutes = minutes
        self.detailedSessions = detailedSessions
        self.summarySessions = summarySessions
        self.completedSets = completedSets
        self.volumeKg = volumeKg
        self.unknownLoadSets = unknownLoadSets
    }
}

public enum Metrics {
    /// The API stores nutrients at referenceGrams, which is not always 100 for imported records.
    /// No intermediate rounding: views can format the final result for their displayed precision.
    public static func mealTotals(_ meal: JSONValue) -> NutritionTotals? {
        guard let grams = meal["grams"].doubleValue, grams > 0, grams <= 10_000,
              let reference = meal["referenceGrams"].doubleValue, reference > 0, reference <= 10_000,
              let kcal = meal["kcal"].doubleValue, (0...100_000).contains(kcal),
              let protein = meal["protein"].doubleValue, (0...10_000).contains(protein),
              let carbs = meal["carbs"].doubleValue, (0...10_000).contains(carbs),
              let fat = meal["fat"].doubleValue, (0...10_000).contains(fat),
              protein + carbs + fat <= reference * 1.1 + 1, kcal <= reference * 12 else { return nil }
        let values = [kcal, protein, carbs, fat].map { $0 / reference * grams }
        guard values.allSatisfy({ $0.isFinite }) else { return nil }
        return NutritionTotals(kcal: values[0], protein: values[1], carbs: values[2], fat: values[3])
    }

    public static func dailySummary(state: JSONValue, date: Date, timeZone: TimeZone = .current) -> DayMetrics {
        guard let day = try? RecordDates.day(date, timeZone: timeZone) else {
            return DayMetrics(day: "", nutrition: nil, trainingMinutes: nil, sleepHours: nil, mealRecords: 0, workoutRecords: 0, sleepRecords: 0)
        }
        return daySummary(state: state, day: day)
    }

    /// Uses persisted calendar dates. Days with no usable record remain absent from metric totals.
    public static func summary(state: JSONValue, days: [String]) -> RangeMetrics {
        let days = Set(days.filter(RecordDates.isDay)).sorted()
        let daily = days.map { daySummary(state: state, day: $0) }
        let nutrition = daily.compactMap(\.nutrition)
        let training = daily.compactMap(\.trainingMinutes)
        let sleep = daily.compactMap(\.sleepHours)
        return RangeMetrics(
            nutrition: sumNutrition(nutrition),
            trainingMinutes: sumKnown(training), sleepHours: sumKnown(sleep),
            nutritionDays: nutrition.count, trainingDays: training.count,
            sleepDays: sleep.count, totalDays: days.count
        )
    }

    /// Legacy exercise summaries are never expanded into performed sets or volume.
    /// Loads in Forma setLogs are stored in kg, regardless of the user's display units.
    public static func trainingSummary(_ workouts: [JSONValue]) -> TrainingMetrics {
        let records = workouts.filter { $0.objectValue != nil }
        let minutes = records.compactMap { workout -> Double? in
            guard let duration = workout["duration"].doubleValue, duration > 0, duration <= 1_440 else { return nil }
            return duration
        }
        var detailed = 0, completed = 0, unknown = 0
        var knownVolumes: [Double] = []
        for workout in records {
            let exercises = workout["exercises"].arrayValue ?? []
            guard exercises.contains(where: { $0["setLogs"].arrayValue != nil }) else { continue }
            detailed += 1
            for exercise in exercises {
                for set in exercise["setLogs"].arrayValue ?? [] {
                    guard set["completed"].boolValue == true,
                          let kind = set["kind"].stringValue, ["work", "drop"].contains(kind) else { continue }
                    let reps = set["reps"].intValue
                    let weight = set["weight"].doubleValue
                    let duration = set["durationSeconds"].doubleValue
                    let knownReps = reps.map { (1...1_000).contains($0) } ?? false
                    let knownWeight = weight.map { (0...2_000).contains($0) } ?? false
                    let knownDuration = duration.map { $0 > 0 && $0 <= 86_400 } ?? false
                    guard (knownReps && knownWeight) || knownDuration else { continue }
                    completed += 1
                    if knownReps, knownWeight, let reps, let weight { knownVolumes.append(weight * Double(reps)) }
                    else { unknown += 1 }
                }
            }
        }
        return TrainingMetrics(
            sessions: records.count, minutes: sumKnown(minutes),
            detailedSessions: detailed, summarySessions: records.count - detailed,
            completedSets: detailed == 0 ? nil : completed,
            volumeKg: sumKnown(knownVolumes), unknownLoadSets: unknown
        )
    }

    private static func daySummary(state: JSONValue, day: String) -> DayMetrics {
        let meals = (state["meals"].arrayValue ?? []).filter { $0["date"].stringValue == day }.compactMap(mealTotals)
        let workouts = (state["workouts"].arrayValue ?? []).filter { $0["date"].stringValue == day }.compactMap { workout -> Double? in
            guard let value = workout["duration"].doubleValue, value > 0, value <= 1_440 else { return nil }
            return value
        }
        let sleep = (state["sleeps"].arrayValue ?? []).filter { $0["date"].stringValue == day }.compactMap { record -> (start: Date, end: Date)? in
            guard let startValue = record["start"].stringValue, let start = RecordDates.parseInstant(startValue),
                  let endValue = record["end"].stringValue, let end = RecordDates.parseInstant(endValue),
                  let identifier = record["timezone"].stringValue, let zone = RecordDates.zone(identifier),
                  (try? RecordDates.day(end, timeZone: zone)) == day else { return nil }
            let interval = end.timeIntervalSince(start)
            guard interval > 0, interval <= 86_400 else { return nil }
            return (start, end)
        }
        return DayMetrics(
            day: day, nutrition: sumNutrition(meals), trainingMinutes: sumKnown(workouts),
            sleepHours: sleep.isEmpty ? nil : mergedHours(sleep),
            mealRecords: meals.count, workoutRecords: workouts.count, sleepRecords: sleep.count
        )
    }

    private static func sumKnown(_ values: [Double]) -> Double? {
        guard !values.isEmpty else { return nil }
        let sum = values.reduce(0, +)
        return sum.isFinite ? sum : nil
    }

    private static func sumNutrition(_ values: [NutritionTotals]) -> NutritionTotals? {
        guard let kcal = sumKnown(values.map(\.kcal)), let protein = sumKnown(values.map(\.protein)),
              let carbs = sumKnown(values.map(\.carbs)), let fat = sumKnown(values.map(\.fat)) else { return nil }
        return NutritionTotals(kcal: kcal, protein: protein, carbs: carbs, fat: fat)
    }

    /// Overlapping observations on the same wake-up day do not create extra hours of sleep.
    private static func mergedHours(_ intervals: [(start: Date, end: Date)]) -> Double {
        let sorted = intervals.sorted { $0.start < $1.start }
        guard let first = sorted.first else { return 0 }
        var start = first.start, end = first.end, seconds = 0.0
        for interval in sorted.dropFirst() {
            if interval.start <= end { end = max(end, interval.end) }
            else {
                seconds += end.timeIntervalSince(start)
                start = interval.start
                end = interval.end
            }
        }
        return (seconds + end.timeIntervalSince(start)) / 3_600
    }
}
