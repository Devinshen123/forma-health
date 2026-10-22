import Foundation

/// Lab reports. Every marker is the user's own transcription of their original document:
/// nothing is extracted by AI, no value is inferred, and a field left blank stays blank.
/// Mirrors `src/features/Reports.tsx` and the service's own report schema.

public enum ReportError: Error, Equatable, Sendable, LocalizedError {
    case invalidName
    case invalidDate
    case invalidMarkerName
    case invalidMarkerValue
    case markerFieldTooLong
    case tooManyMarkers
    case emptyReport
    case invalidAttachment

    public var errorDescription: String? {
        switch self {
        case .invalidName: return "Enter a report name of 1 to 160 characters."
        case .invalidDate: return "Choose a valid report date."
        case .invalidMarkerName: return "Every marker needs a name of 1 to 160 characters."
        case .invalidMarkerValue: return "Every marker needs the original value from your document, up to 500 characters."
        case .markerFieldTooLong: return "A marker's unit, range or notes is too long."
        case .tooManyMarkers: return "A report holds at most 200 markers."
        case .emptyReport: return "Add the original attachment, or at least one marker you typed yourself."
        case .invalidAttachment: return "This attachment reference is not valid."
        }
    }
}

public struct ReportMarker: Equatable, Sendable {
    public let name: String
    public let value: String
    public let unit: String
    public let range: String
    public let notes: String

    public init(name: String = "", value: String = "", unit: String = "", range: String = "", notes: String = "") {
        self.name = name
        self.value = value
        self.unit = unit
        self.range = range
        self.notes = notes
    }

    /// A row the user has started filling in. An untouched row is dropped rather than saved empty,
    /// exactly as the website's `hasMarkerContent` does.
    public var isFilled: Bool {
        [name, value, unit, range, notes].contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    public init?(_ value: JSONValue) {
        guard let name = value["name"].stringValue, let reading = value["value"].stringValue else { return nil }
        self.name = name
        self.value = reading
        unit = value["unit"].stringValue ?? ""
        range = value["range"].stringValue ?? ""
        notes = value["notes"].stringValue ?? ""
    }
}

public struct ReportView: Identifiable, Equatable, Sendable {
    public let id: String
    public let name: String
    /// The report's own calendar day, as recorded. It is never recomputed from the device clock.
    public let date: String
    public let assetId: String?
    public let markers: [ReportMarker]
    public let extractionStatus: String
    public let createdAt: String

    public var hasAttachment: Bool { assetId != nil }

    public init?(_ value: JSONValue) {
        guard let id = value["id"].stringValue, !id.isEmpty,
              let name = value["name"].stringValue,
              let date = value["date"].stringValue else { return nil }
        self.id = id
        self.name = name
        self.date = date
        assetId = value["assetId"].stringValue
        markers = (value["markers"].arrayValue ?? []).compactMap(ReportMarker.init)
        extractionStatus = value["extractionStatus"].stringValue ?? "manual"
        createdAt = value["createdAt"].stringValue ?? ""
    }
}

public enum ReportState {
    /// Newest report day first, then newest entry, matching the website's order.
    public static func reports(_ state: JSONValue) -> [ReportView] {
        (state["reports"].arrayValue ?? [])
            .compactMap(ReportView.init)
            .sorted {
                $0.date == $1.date ? $0.createdAt > $1.createdAt : $0.date > $1.date
            }
    }

    public static func report(_ state: JSONValue, id: String) -> ReportView? {
        reports(state).first { $0.id == id }
    }

    /// Whether any record still points at this attachment. The service refuses to delete one that
    /// is referenced, so the reference is removed first.
    public static func attachmentIsReferenced(_ state: JSONValue, assetId: String) -> Bool {
        reports(state).contains { $0.assetId == assetId }
    }
}

public enum NativeReports {
    public static let markerLimit = 200
    static let nameLimit = 160
    static let valueLimit = 500
    static let unitLimit = 100
    static let rangeLimit = 500
    static let notesLimit = 2000

    /// Builds a manual lab report. Markers are trimmed on their name and value, exactly as the
    /// service's schema expects, while unit, range and notes are stored as the user typed them.
    /// A report with no attachment must carry at least one marker, so nothing is ever saved empty.
    public static func report(
        id: String = UUID().uuidString.lowercased(),
        name: String, date: Date, assetId: String? = nil,
        markers: [ReportMarker], createdAt: String? = nil,
        timeZone: TimeZone = .current
    ) throws -> JSONValue {
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, name.count <= nameLimit else { throw ReportError.invalidName }
        guard let day = try? RecordDates.day(date, timeZone: timeZone) else { throw ReportError.invalidDate }
        if let assetId {
            guard !assetId.isEmpty, UUID(uuidString: assetId) != nil else { throw ReportError.invalidAttachment }
        }

        let filled = markers.filter(\.isFilled)
        guard filled.count <= markerLimit else { throw ReportError.tooManyMarkers }
        var encoded: [JSONValue] = []
        for marker in filled {
            let markerName = marker.name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !markerName.isEmpty, markerName.count <= nameLimit else { throw ReportError.invalidMarkerName }
            let value = marker.value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty, value.count <= valueLimit else { throw ReportError.invalidMarkerValue }
            guard marker.unit.count <= unitLimit, marker.range.count <= rangeLimit,
                  marker.notes.count <= notesLimit else { throw ReportError.markerFieldTooLong }
            encoded.append(.object([
                "name": .string(markerName), "value": .string(value),
                "unit": .string(marker.unit), "range": .string(marker.range),
                "notes": .string(marker.notes),
            ]))
        }
        guard assetId != nil || !encoded.isEmpty else { throw ReportError.emptyReport }

        var object: [String: JSONValue] = [
            "id": .string(id),
            "name": .string(name),
            "date": .string(day),
            "markers": .array(encoded),
            // Never "extracted": this build has no AI reading of a document.
            "extractionStatus": .string("manual"),
            "createdAt": .string(createdAt ?? wireInstant(Date())),
        ]
        // The key is absent rather than null when there is no attachment, as the schema requires.
        if let assetId { object["assetId"] = .string(assetId) }
        return .object(object)
    }

    /// The same report with its attachment reference removed, so the service will then allow the
    /// attachment itself to be deleted. Refuses a report that would be left with nothing in it.
    /// A report whose only content is the attachment cannot have it removed here: the result
    /// would be an empty record, so `.emptyReport` is thrown rather than saving nothing.
    public static func removingAttachment(from report: ReportView) throws -> JSONValue {
        try NativeReports.report(id: report.id, name: report.name,
                                 date: try day(report.date), assetId: nil,
                                 markers: report.markers, createdAt: report.createdAt)
    }

    /// Reads a stored `yyyy-MM-dd` back as a date, so an edit keeps the report's own day.
    /// The zone must be the one the day will be written back in: parsing in one zone and
    /// formatting in another moves the report a day in either direction.
    public static func day(_ value: String, timeZone: TimeZone = .current) throws -> Date {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: value) else { throw ReportError.invalidDate }
        return date
    }
}
