import Foundation
import HealthKit
import FormaCore

enum HealthSampleMapper {
    static func record(_ sample: HKSample) throws -> HealthImportRecord {
        let source = sample.sourceRevision.source
        var metadata: [String: JSONValue] = ["bridge": .string("apple-health"),
                                              "deviceTimezoneAtImport": .string(TimeZone.current.identifier)]
        if let timezone = sample.metadata?[HKMetadataKeyTimeZone] as? String {
            metadata["timezone"] = .string(String(timezone.prefix(160)))
        }
        if let product = sample.sourceRevision.productType { metadata["productType"] = .string(String(product.prefix(160))) }
        if let device = sample.device {
            if let name = device.name { metadata["deviceName"] = .string(String(name.prefix(160))) }
            if let model = device.model { metadata["deviceModel"] = .string(String(model.prefix(160))) }
        }
        if let entered = sample.metadata?[HKMetadataKeyWasUserEntered] as? Bool { metadata["wasUserEntered"] = .bool(entered) }
        let kind: String
        let unit: String
        let value: Double
        if let quantity = sample as? HKQuantitySample {
            switch quantity.quantityType.identifier {
            case HKQuantityTypeIdentifier.stepCount.rawValue:
                kind = "steps"; unit = "count"; value = quantity.quantity.doubleValue(for: .count())
            case HKQuantityTypeIdentifier.activeEnergyBurned.rawValue:
                kind = "active_energy"; unit = "kcal"; value = quantity.quantity.doubleValue(for: .kilocalorie())
            case HKQuantityTypeIdentifier.heartRate.rawValue:
                kind = "heart_rate"; unit = "bpm"
                value = quantity.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
            case HKQuantityTypeIdentifier.restingHeartRate.rawValue:
                kind = "resting_heart_rate"; unit = "bpm"
                value = quantity.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
            case HKQuantityTypeIdentifier.heartRateVariabilitySDNN.rawValue:
                kind = "hrv_sdnn"; unit = "ms"; value = quantity.quantity.doubleValue(for: .secondUnit(with: .milli))
            default: throw HealthImportValidation.invalidSample
            }
        } else if let sleep = sample as? HKCategorySample,
                  sleep.categoryType.identifier == HKCategoryTypeIdentifier.sleepAnalysis.rawValue {
            kind = "sleep"; unit = "min"; value = sleep.endDate.timeIntervalSince(sleep.startDate) / 60
            // Preserve stage intervals independently: never sum in-bed + asleep/core/deep/REM.
            let stages = [0: "in_bed", 1: "asleep_unspecified", 2: "awake", 3: "asleep_core", 4: "asleep_deep", 5: "asleep_rem"]
            metadata["sleepStage"] = .string(stages[sleep.value] ?? "unknown")
            metadata["categoryValue"] = .number(Double(sleep.value))
        } else if let workout = sample as? HKWorkout {
            kind = "workout"; unit = "min"; value = workout.duration / 60
            metadata["activityType"] = .number(Double(workout.workoutActivityType.rawValue))
            if let energy = workout.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity() {
                metadata["activeEnergyKcal"] = .number(energy.doubleValue(for: .kilocalorie()))
            }
            if let distance = workout.totalDistance {
                metadata["distanceMeters"] = .number(distance.doubleValue(for: .meter()))
            }
        } else { throw HealthImportValidation.invalidSample }
        return try HealthImportRecord(id: sample.uuid, kind: kind, start: sample.startDate, end: sample.endDate,
                                      value: value, unit: unit, sourceID: source.bundleIdentifier,
                                      sourceName: source.name, deviceID: sample.device?.localIdentifier, metadata: metadata)
    }
}
