import Foundation

public enum NativeRecordError: Error, Equatable, Sendable, LocalizedError {
    case invalidName
    case invalidDate
    case invalidServing
    case invalidNutrients
    case invalidMealType
    case invalidSleepRange
    case invalidRating
    case invalidTimezone
    case invalidDuration
    case invalidExercise
    case notesTooLong

    public var errorDescription: String? {
        switch self {
        case .invalidName: return "Enter a visible name of at most 160 characters."
        case .invalidDate: return "Choose a valid date."
        case .invalidServing: return "Enter a serving greater than zero and no more than 10,000 g."
        case .invalidNutrients: return "Check the nutrition values per 100 g."
        case .invalidMealType: return "Choose breakfast, lunch, dinner or snack."
        case .invalidSleepRange: return "Sleep must end after it starts and last no more than 24 hours."
        case .invalidRating: return "Quality and energy must be between 1 and 5."
        case .invalidTimezone: return "Choose a valid IANA time zone."
        case .invalidDuration: return "Enter a recorded duration greater than zero and no more than 1,440 minutes."
        case .invalidExercise: return "Enter 1–100 sets, 1–1,000 reps and a load from 0 to 2,000 kg."
        case .notesTooLong: return "Notes must be no longer than 10,000 characters."
        }
    }
}

/// Factories only contain user-entered facts. They do not call AI or invent set details.
public enum NativeRecords {
    public static func meal(
        name: String, date: Date, grams: Double,
        kcal: Double, protein: Double, carbs: Double, fat: Double, type: String
    ) throws -> JSONValue {
        let name = try visibleName(name)
        guard grams.isFinite, grams > 0, grams <= 10_000 else { throw NativeRecordError.invalidServing }
        guard [kcal, protein, carbs, fat].allSatisfy({ $0.isFinite && $0 >= 0 }),
              kcal <= 1_200, protein + carbs + fat <= 111 else {
            throw NativeRecordError.invalidNutrients
        }
        guard ["breakfast", "lunch", "dinner", "snack"].contains(type) else { throw NativeRecordError.invalidMealType }
        return .object([
            "id": .string(UUID().uuidString.lowercased()),
            "date": .string(try RecordDates.day(date, timeZone: .current)),
            "name": .string(name), "type": .string(type),
            "grams": .number(grams), "referenceGrams": .number(100),
            "kcal": .number(kcal), "protein": .number(protein),
            "carbs": .number(carbs), "fat": .number(fat),
            "source": .string("manual"), "createdAt": .string(try RecordDates.instant(Date()))
        ])
    }

    public static func sleep(
        start: Date, end: Date, quality: Int, energy: Int, timezone: String
    ) throws -> JSONValue {
        guard let zone = RecordDates.zone(timezone) else { throw NativeRecordError.invalidTimezone }
        guard (1...5).contains(quality), (1...5).contains(energy) else { throw NativeRecordError.invalidRating }
        let interval = end.timeIntervalSince(start)
        guard interval.isFinite, interval > 0, interval <= 86_400 else { throw NativeRecordError.invalidSleepRange }
        let startValue = try RecordDates.instant(start), endValue = try RecordDates.instant(end)
        guard let savedStart = RecordDates.parseInstant(startValue), let savedEnd = RecordDates.parseInstant(endValue) else { throw NativeRecordError.invalidDate }
        let savedInterval = savedEnd.timeIntervalSince(savedStart)
        guard savedInterval > 0, savedInterval <= 86_400 else { throw NativeRecordError.invalidSleepRange }
        return .object([
            "id": .string(UUID().uuidString.lowercased()),
            "date": .string(try RecordDates.day(savedEnd, timeZone: zone)),
            "start": .string(startValue), "end": .string(endValue),
            "quality": .number(Double(quality)), "energy": .number(Double(energy)),
            "source": .string("manual"), "timezone": .string(timezone),
            "createdAt": .string(try RecordDates.instant(Date()))
        ])
    }

    /// A legacy exercise summary records the actual summary entered by the user, not individual sets.
    public static func workout(
        name: String, date: Date, duration: Double,
        exerciseName: String, sets: Int, reps: Int, weight: Double, notes: String
    ) throws -> JSONValue {
        let name = try visibleName(name), exerciseName = try visibleName(exerciseName)
        guard duration.isFinite, duration > 0, duration <= 1_440 else { throw NativeRecordError.invalidDuration }
        guard (1...100).contains(sets), (1...1_000).contains(reps),
              weight.isFinite, weight >= 0, weight <= 2_000 else { throw NativeRecordError.invalidExercise }
        guard notes.utf16.count <= 10_000 else { throw NativeRecordError.notesTooLong }
        return .object([
            "id": .string(UUID().uuidString.lowercased()),
            "date": .string(try RecordDates.day(date, timeZone: .current)), "name": .string(name),
            "duration": .number(duration), "rpe": .null,
            "exercises": .array([.object([
                "name": .string(exerciseName), "sets": .number(Double(sets)),
                "reps": .number(Double(reps)), "weight": .number(weight)
            ])]),
            "notes": .string(notes), "source": .string("manual"),
            "createdAt": .string(try RecordDates.instant(Date()))
        ])
    }

    private static func visibleName(_ value: String) throws -> String {
        let name = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let controls = name.unicodeScalars.contains { $0.value < 32 || (127...159).contains($0.value) }
        guard !name.isEmpty, name.utf16.count <= 160, !controls else { throw NativeRecordError.invalidName }
        return name
    }
}

enum RecordDates {
    static func zone(_ identifier: String) -> TimeZone? {
        guard identifier.utf16.count <= 100,
              identifier == "UTC" || identifier == "GMT" || TimeZone.knownTimeZoneIdentifiers.contains(identifier) else { return nil }
        return TimeZone(identifier: identifier)
    }

    static func day(_ date: Date, timeZone: TimeZone) throws -> String {
        guard date.timeIntervalSince1970.isFinite else { throw NativeRecordError.invalidDate }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.era, .year], from: date)
        guard parts.era == 1, let year = parts.year, (1...9_999).contains(year) else { throw NativeRecordError.invalidDate }
        let formatter = dayFormatter(timeZone)
        return formatter.string(from: date)
    }

    static func isDay(_ value: String) -> Bool {
        guard value.utf8.count == 10, value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else { return false }
        let formatter = dayFormatter(TimeZone(secondsFromGMT: 0)!)
        guard let date = formatter.date(from: value) else { return false }
        return (try? day(date, timeZone: TimeZone(secondsFromGMT: 0)!)) == value
    }

    static func instant(_ date: Date) throws -> String {
        _ = try day(date, timeZone: TimeZone(secondsFromGMT: 0)!)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter.string(from: date)
    }

    static func parseInstant(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value), date.timeIntervalSince1970.isFinite { return date }
        formatter.formatOptions = [.withInternetDateTime]
        guard let date = formatter.date(from: value), date.timeIntervalSince1970.isFinite else { return nil }
        return date
    }

    private static func dayFormatter(_ timeZone: TimeZone) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.isLenient = false
        return formatter
    }
}
