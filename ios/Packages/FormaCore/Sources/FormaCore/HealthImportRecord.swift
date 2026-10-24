import Foundation

/// Wire contract shared with src/health.ts. Values are samples, never cross-source totals.
public struct HealthImportRecord: Identifiable, Equatable, Sendable {
    public let id: String
    public let kind: String
    public let startTime: String
    public let endTime: String
    public let value: Double?
    public let unit: String
    public let sourceID: String
    public let sourceName: String
    public let deviceID: String?
    public let metadata: [String: JSONValue]

    public init(id: UUID, kind: String, start: Date, end: Date, value: Double?, unit: String,
                sourceID: String, sourceName: String, deviceID: String? = nil,
                metadata: [String: JSONValue] = [:]) throws {
        let units = ["steps": "count", "active_energy": "kcal", "heart_rate": "bpm",
                     "resting_heart_rate": "bpm", "hrv_sdnn": "ms", "sleep": "min", "workout": "min"]
        guard units[kind] == unit, start.timeIntervalSince1970.isFinite,
              end.timeIntervalSince1970.isFinite, start <= end,
              value == nil || (value!.isFinite && value! >= 0),
              !sourceID.isEmpty, !sourceName.isEmpty else { throw HealthImportValidation.invalidSample }
        self.id = id.uuidString.lowercased(); self.kind = kind
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        self.startTime = formatter.string(from: start); self.endTime = formatter.string(from: end)
        self.value = value; self.unit = unit
        self.sourceID = String(sourceID.prefix(160)); self.sourceName = String(sourceName.prefix(160))
        self.deviceID = deviceID.map { String($0.prefix(160)) }; self.metadata = metadata
    }

    public var json: JSONValue {
        var source: [String: JSONValue] = ["sourceId": .string(sourceID), "sourceName": .string(sourceName)]
        if let deviceID { source["deviceId"] = .string(deviceID) }
        return .object(["id": .string(id), "kind": .string(kind), "startTime": .string(startTime),
                        "endTime": .string(endTime), "value": value.map(JSONValue.number) ?? .null,
                        "unit": .string(unit), "source": .object(source), "metadata": .object(metadata)])
    }
}

public enum HealthImportValidation: Error { case invalidSample }

public enum HealthImportBatch {
    /// A single request has at most 200 additions + deletions. Replays retain the source UUIDs.
    public static func payloads(records: [HealthImportRecord], deletedIDs: [String], expectedRevision: Int) -> [JSONValue] {
        var payloads: [JSONValue] = []
        var offset = 0
        let count = records.count + deletedIDs.count
        repeat {
            let end = min(offset + 200, count)
            let additions = offset < records.count ? Array(records[offset..<min(end, records.count)]) : []
            let deleteStart = max(0, offset - records.count)
            let deleteEnd = max(0, end - records.count)
            let deletions = deleteEnd > deleteStart ? Array(deletedIDs[deleteStart..<deleteEnd]) : []
            payloads.append(.object(["consent": .bool(true), "expectedRevision": .number(Double(expectedRevision)),
                                     "records": .array(additions.map(\.json)),
                                     "deletedIds": .array(deletions.map(JSONValue.string))]))
            offset = end
        } while offset < count
        return payloads
    }
}
