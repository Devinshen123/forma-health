import Foundation
import XCTest
@testable import FormaCore

final class ReportTests: XCTestCase {
    private let asset = "11111111-2222-3333-4444-555555555555"

    private func day(_ value: String) throws -> Date {
        try XCTUnwrap(try? NativeReports.day(value, timeZone: TimeZone(secondsFromGMT: 0)!))
    }

    private func utc() -> TimeZone { TimeZone(secondsFromGMT: 0)! }

    // MARK: - Building a manual report

    func testAManualReportCarriesOnlyWhatTheUserTyped() throws {
        let document = try NativeReports.report(
            id: "r1", name: "  Blood panel  ", date: try day("2026-10-20"),
            markers: [ReportMarker(name: "  Ferritin ", value: " 42 ", unit: "ng/mL",
                                   range: "30–400", notes: "fasting")],
            createdAt: "2026-10-20T08:00:00.000Z", timeZone: utc())
        XCTAssertEqual(document["id"].stringValue, "r1")
        XCTAssertEqual(document["name"].stringValue, "Blood panel", "The name is trimmed")
        XCTAssertEqual(document["date"].stringValue, "2026-10-20")
        XCTAssertEqual(document["extractionStatus"].stringValue, "manual",
                       "Nothing in this build extracts a document")
        XCTAssertEqual(document["createdAt"].stringValue, "2026-10-20T08:00:00.000Z")
        XCTAssertNil(document.objectValue?["assetId"], "Without an attachment the key is absent, not null")
        let markers = try XCTUnwrap(document["markers"].arrayValue)
        XCTAssertEqual(markers.count, 1)
        XCTAssertEqual(markers[0]["name"].stringValue, "Ferritin", "A marker name is trimmed")
        XCTAssertEqual(markers[0]["value"].stringValue, "42", "A marker value is trimmed")
        XCTAssertEqual(markers[0]["unit"].stringValue, "ng/mL", "A unit is stored as typed")
        XCTAssertEqual(markers[0]["range"].stringValue, "30–400")
        XCTAssertEqual(markers[0]["notes"].stringValue, "fasting")
    }

    func testUntouchedMarkerRowsAreDroppedInsteadOfSavedEmpty() throws {
        let document = try NativeReports.report(
            name: "Panel", date: try day("2026-10-20"),
            markers: [ReportMarker(name: "Ferritin", value: "42"), ReportMarker(), ReportMarker()],
            timeZone: utc())
        XCTAssertEqual(document["markers"].arrayValue?.count, 1)
        XCTAssertFalse(ReportMarker().isFilled)
        XCTAssertTrue(ReportMarker(notes: "only a note").isFilled,
                      "A row with any content counts as started")
        XCTAssertFalse(ReportMarker(name: "   ", value: "  ").isFilled, "Whitespace alone is not content")
    }

    func testAReportNeedsAnAttachmentOrAtLeastOneMarker() throws {
        XCTAssertThrowsError(try NativeReports.report(name: "Panel", date: try day("2026-10-20"),
                                                      markers: [], timeZone: utc())) {
            XCTAssertEqual($0 as? ReportError, .emptyReport)
        }
        XCTAssertThrowsError(try NativeReports.report(name: "Panel", date: try day("2026-10-20"),
                                                      markers: [ReportMarker()], timeZone: utc())) {
            XCTAssertEqual($0 as? ReportError, .emptyReport, "A blank row is not content")
        }
        // An attachment alone is enough, which is how a report saved on the website can look.
        let attached = try NativeReports.report(name: "Panel", date: try day("2026-10-20"),
                                                assetId: asset, markers: [], timeZone: utc())
        XCTAssertEqual(attached["assetId"].stringValue, asset)
        XCTAssertEqual(attached["markers"].arrayValue, [])
    }

    func testEveryLimitMatchesTheServiceSchema() throws {
        let date = try day("2026-10-20")
        func build(name: String = "Panel", marker: ReportMarker = ReportMarker(name: "A", value: "1")) throws -> JSONValue {
            try NativeReports.report(name: name, date: date, markers: [marker], timeZone: utc())
        }
        XCTAssertNoThrow(try build(name: String(repeating: "n", count: 160)))
        XCTAssertThrowsError(try build(name: String(repeating: "n", count: 161))) {
            XCTAssertEqual($0 as? ReportError, .invalidName)
        }
        XCTAssertThrowsError(try build(name: "   ")) { XCTAssertEqual($0 as? ReportError, .invalidName) }
        XCTAssertThrowsError(try build(marker: ReportMarker(name: String(repeating: "m", count: 161), value: "1"))) {
            XCTAssertEqual($0 as? ReportError, .invalidMarkerName)
        }
        XCTAssertThrowsError(try build(marker: ReportMarker(name: "", value: "1", notes: "x"))) {
            XCTAssertEqual($0 as? ReportError, .invalidMarkerName, "A started row still needs a name")
        }
        XCTAssertThrowsError(try build(marker: ReportMarker(name: "A", value: "", notes: "x"))) {
            XCTAssertEqual($0 as? ReportError, .invalidMarkerValue, "A started row still needs its value")
        }
        XCTAssertNoThrow(try build(marker: ReportMarker(name: "A", value: String(repeating: "1", count: 500))))
        XCTAssertThrowsError(try build(marker: ReportMarker(name: "A", value: String(repeating: "1", count: 501)))) {
            XCTAssertEqual($0 as? ReportError, .invalidMarkerValue)
        }
        XCTAssertNoThrow(try build(marker: ReportMarker(name: "A", value: "1", unit: String(repeating: "u", count: 100))))
        XCTAssertThrowsError(try build(marker: ReportMarker(name: "A", value: "1", unit: String(repeating: "u", count: 101)))) {
            XCTAssertEqual($0 as? ReportError, .markerFieldTooLong)
        }
        XCTAssertNoThrow(try build(marker: ReportMarker(name: "A", value: "1", range: String(repeating: "r", count: 500))))
        XCTAssertThrowsError(try build(marker: ReportMarker(name: "A", value: "1", range: String(repeating: "r", count: 501)))) {
            XCTAssertEqual($0 as? ReportError, .markerFieldTooLong)
        }
        XCTAssertNoThrow(try build(marker: ReportMarker(name: "A", value: "1", notes: String(repeating: "x", count: 2000))))
        XCTAssertThrowsError(try build(marker: ReportMarker(name: "A", value: "1", notes: String(repeating: "x", count: 2001)))) {
            XCTAssertEqual($0 as? ReportError, .markerFieldTooLong)
        }
        let many = (0..<201).map { ReportMarker(name: "m\($0)", value: "1") }
        XCTAssertEqual(NativeReports.markerLimit, 200)
        XCTAssertThrowsError(try NativeReports.report(name: "Panel", date: date, markers: many, timeZone: utc())) {
            XCTAssertEqual($0 as? ReportError, .tooManyMarkers)
        }
        XCTAssertNoThrow(try NativeReports.report(name: "Panel", date: date,
                                                  markers: Array(many.prefix(200)), timeZone: utc()))
    }

    func testAnAttachmentReferenceMustBeAnIdTheServiceCouldHaveIssued() throws {
        let date = try day("2026-10-20")
        for invalid in ["", "not-an-id", "1234", "11111111-2222-3333-4444-5555555555"] {
            XCTAssertThrowsError(try NativeReports.report(name: "Panel", date: date, assetId: invalid,
                                                          markers: [], timeZone: utc())) {
                XCTAssertEqual($0 as? ReportError, .invalidAttachment, "accepted \(invalid)")
            }
        }
    }

    // MARK: - The report's own day

    func testTheReportDayRoundTripsInWhicheverZoneItIsWrittenIn() throws {
        for identifier in ["UTC", "Asia/Shanghai", "America/Los_Angeles", "Pacific/Kiritimati"] {
            let zone = try XCTUnwrap(TimeZone(identifier: identifier))
            let parsed = try XCTUnwrap(try? NativeReports.day("2026-10-20", timeZone: zone))
            let document = try NativeReports.report(name: "Panel", date: parsed,
                                                   markers: [ReportMarker(name: "A", value: "1")],
                                                   timeZone: zone)
            XCTAssertEqual(document["date"].stringValue, "2026-10-20",
                           "The day moved in \(identifier)")
        }
        XCTAssertThrowsError(try NativeReports.day("2026-13-40")) {
            XCTAssertEqual($0 as? ReportError, .invalidDate)
        }
        XCTAssertThrowsError(try NativeReports.day("not a date")) {
            XCTAssertEqual($0 as? ReportError, .invalidDate)
        }
    }

    // MARK: - Reading reports out of state

    private var state: JSONValue {
        .object(["reports": .array([
            .object(["id": .string("a"), "name": .string("Older"), "date": .string("2026-10-01"),
                     "markers": .array([]), "assetId": .string(asset),
                     "extractionStatus": .string("manual"), "createdAt": .string("2026-10-01T00:00:00.000Z")]),
            .object(["id": .string("b"), "name": .string("Same day, earlier"), "date": .string("2026-10-20"),
                     "markers": .array([.object(["name": .string("A"), "value": .string("1"),
                                                 "unit": .string(""), "range": .string(""), "notes": .string("")])]),
                     "extractionStatus": .string("manual"), "createdAt": .string("2026-10-20T01:00:00.000Z")]),
            .object(["id": .string("c"), "name": .string("Same day, later"), "date": .string("2026-10-20"),
                     "markers": .array([]), "assetId": .string(asset),
                     "extractionStatus": .string("manual"), "createdAt": .string("2026-10-20T09:00:00.000Z")]),
            .object(["name": .string("No id")]),
        ])])
    }

    func testReportsAreNewestDayFirstThenNewestEntryAndBrokenRowsAreSkipped() {
        let reports = ReportState.reports(state)
        XCTAssertEqual(reports.map(\.id), ["c", "b", "a"])
        XCTAssertEqual(reports[0].name, "Same day, later")
        XCTAssertTrue(reports[0].hasAttachment)
        XCTAssertFalse(reports[1].hasAttachment)
        XCTAssertEqual(reports[1].markers.map(\.name), ["A"])
        XCTAssertEqual(ReportState.report(state, id: "b")?.name, "Same day, earlier")
        XCTAssertNil(ReportState.report(state, id: "missing"))
        XCTAssertTrue(ReportState.reports(.object([:])).isEmpty)
    }

    func testAReferencedAttachmentIsKnownToBeReferenced() {
        XCTAssertTrue(ReportState.attachmentIsReferenced(state, assetId: asset))
        XCTAssertFalse(ReportState.attachmentIsReferenced(state, assetId: UUID().uuidString.lowercased()))
    }

    // MARK: - Removing an attachment

    func testRemovingAnAttachmentKeepsTheReportAndItsOwnDayAndCreatedAt() throws {
        let report = try XCTUnwrap(ReportState.report(state, id: "b"))
        // b has markers but no attachment, so give it one to remove.
        let withAttachment = try NativeReports.report(id: report.id, name: report.name,
                                                      date: try day(report.date), assetId: asset,
                                                      markers: report.markers,
                                                      createdAt: report.createdAt, timeZone: utc())
        let parsed = try XCTUnwrap(ReportView(withAttachment))
        let stripped = try NativeReports.removingAttachment(from: parsed)
        XCTAssertNil(stripped.objectValue?["assetId"], "The reference is gone, not set to null")
        XCTAssertEqual(stripped["id"].stringValue, "b", "It is the same record, not a new one")
        XCTAssertEqual(stripped["date"].stringValue, "2026-10-20", "Its own day is unchanged")
        XCTAssertEqual(stripped["createdAt"].stringValue, "2026-10-20T01:00:00.000Z",
                       "When it was recorded does not change")
        XCTAssertEqual(stripped["markers"].arrayValue?.count, 1, "Its markers are untouched")
    }

    func testAnAttachmentOnlyReportRefusesToLoseItsLastContent() throws {
        let report = try XCTUnwrap(ReportState.report(state, id: "c"))
        XCTAssertTrue(report.markers.isEmpty)
        XCTAssertThrowsError(try NativeReports.removingAttachment(from: report)) {
            XCTAssertEqual($0 as? ReportError, .emptyReport,
                           "Removing the only content would leave an empty record")
        }
    }
}
