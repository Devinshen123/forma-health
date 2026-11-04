import Foundation

/// The three series the website's Trends page can chart, in its order.
public enum TrendMetric: String, CaseIterable, Sendable {
    case nutrition, training, sleep
}

/// The website offers the last 7 or the last 14 days, both ending today.
public enum TrendRange: Int, CaseIterable, Sendable {
    case week = 7
    case fortnight = 14
}

public struct TrendDay: Equatable, Sendable {
    public let day: String
    /// Usable food energy that day, or nil - never zero - when nothing usable was recorded.
    public let kcal: Double?
    public let trainingMinutes: Double?
    public let sleepHours: Double?
    /// Saved records dated this day, as the website lists them, whether or not they hold usable numbers.
    public let mealRecords: Int
    public let workoutRecords: Int
    public let sleepRecords: Int
    public let mealNames: [String]
    public let workoutNames: [String]
    /// True when any food record that day came from an estimate, which changes the stated source.
    public let includesEstimate: Bool

    public func value(_ metric: TrendMetric) -> Double? {
        switch metric {
        case .nutrition: kcal
        case .training: trainingMinutes
        case .sleep: sleepHours
        }
    }

    /// All three categories have a usable value. Record coverage, not a health score.
    public var hasAllThree: Bool { kcal != nil && trainingMinutes != nil && sleepHours != nil }
}

public struct TrendsSummary: Equatable, Sendable {
    public let range: TrendRange
    /// Oldest first, ending today, one entry per calendar day in the range.
    public let days: [TrendDay]

    public func recordedDays(_ metric: TrendMetric) -> Int { days.filter { $0.value(metric) != nil }.count }

    public var daysWithAllThree: Int { days.filter(\.hasAllThree).count }

    /// The website's "complete" next step only when every day of the range holds all three.
    public var isComplete: Bool { daysWithAllThree == range.rawValue }

    /// Mean over recorded days only; nil when no day has sleep.
    public var averageSleepHours: Double? {
        let known = days.compactMap(\.sleepHours)
        guard !known.isEmpty else { return nil }
        return known.reduce(0, +) / Double(known.count)
    }

    /// Sum over recorded days only; nil when no day has training.
    public var totalTrainingMinutes: Double? {
        let known = days.compactMap(\.trainingMinutes)
        guard !known.isEmpty else { return nil }
        return known.reduce(0, +)
    }

    public var mealRecords: Int { days.reduce(0) { $0 + $1.mealRecords } }

    /// Same axis as the website: 15% headroom above the largest known value, never below 1.15.
    public func chartMaximum(_ metric: TrendMetric) -> Double {
        (days.compactMap { $0.value(metric) } + [1]).max()! * 1.15
    }

    /// Runs of consecutive day indices with a value. A line is drawn only within a run, so a
    /// missing day breaks the line instead of being joined across or dropped to zero.
    public func segments(_ metric: TrendMetric) -> [[Int]] {
        var result: [[Int]] = []
        var previousKnown = false
        for (index, day) in days.enumerated() {
            guard day.value(metric) != nil else { previousKnown = false; continue }
            if previousKnown { result[result.count - 1].append(index) } else { result.append([index]) }
            previousKnown = true
        }
        return result
    }
}

extension Metrics {
    /// The zone the website uses to decide which day is "today": the profile's, else the device's.
    public static func profileTimeZone(state: JSONValue, fallback: TimeZone = .current) -> TimeZone {
        state["profile"]["timezone"].stringValue.flatMap(RecordDates.zone) ?? fallback
    }

    /// Mirrors the website's Trends page: the 7 or 14 calendar days ending today, oldest first,
    /// with each day's food energy, training minutes and merged sleep hours - nil on a day
    /// without a usable record - plus the records saved that day.
    public static func trends(state: JSONValue, range: TrendRange, today: Date = Date(),
                              timeZone: TimeZone = .current) -> TrendsSummary {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let count = range.rawValue
        let dayNames = (0..<count).compactMap { offset -> String? in
            guard let date = calendar.date(byAdding: .day, value: offset - count + 1, to: today) else { return nil }
            return try? RecordDates.day(date, timeZone: timeZone)
        }
        let meals = state["meals"].arrayValue ?? []
        let workouts = state["workouts"].arrayValue ?? []
        let sleeps = state["sleeps"].arrayValue ?? []
        let days = dayNames.map { day -> TrendDay in
            let metrics = summary(state: state, days: [day])
            let dayMeals = meals.filter { $0["date"].stringValue == day }
            let dayWorkouts = workouts.filter { $0["date"].stringValue == day }
            return TrendDay(
                day: day, kcal: metrics.nutrition?.kcal,
                trainingMinutes: metrics.trainingMinutes, sleepHours: metrics.sleepHours,
                mealRecords: dayMeals.count, workoutRecords: dayWorkouts.count,
                sleepRecords: sleeps.filter { $0["date"].stringValue == day }.count,
                mealNames: dayMeals.compactMap { $0["name"].stringValue },
                workoutNames: dayWorkouts.compactMap { $0["name"].stringValue },
                includesEstimate: dayMeals.contains { $0["source"].stringValue == "ai_estimate" }
            )
        }
        return TrendsSummary(range: range, days: days)
    }
}
