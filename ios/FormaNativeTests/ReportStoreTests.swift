import XCTest
import FormaCore
@testable import Forma

/// Synthetic only: a state set directly on an isolated store. No account, Keychain, attachment
/// bytes or deployed service is involved.
final class ReportStoreTests: XCTestCase {
    private static let asset = "11111111-2222-3333-4444-555555555555"

    private static let state: JSONValue = .object(["reports": .array([
        .object(["id": .string("r1"), "name": .string("Blood panel"), "date": .string("2026-10-20"),
                 "markers": .array([.object(["name": .string("Ferritin"), "value": .string("42"),
                                             "unit": .string("ng/mL"), "range": .string("30–400"),
                                             "notes": .string("")])]),
                 "assetId": .string(asset),
                 "extractionStatus": .string("manual"), "createdAt": .string("2026-10-20T08:00:00.000Z")]),
        .object(["id": .string("r2"), "name": .string("Original only"), "date": .string("2026-10-01"),
                 "markers": .array([]), "assetId": .string(asset),
                 "extractionStatus": .string("manual"), "createdAt": .string("2026-10-01T08:00:00.000Z")]),
    ])])

    @MainActor private func makeStore(demo: Bool) -> AppStore {
        let store = AppStore(uiTesting: true)
        if demo { store.enterDemo() }
        store.state = Self.state
        return store
    }

    // MARK: - Reading

    @MainActor func testTheStoreReadsReportsNewestDayFirst() throws {
        let store = makeStore(demo: false)
        XCTAssertEqual(store.reports.map(\.id), ["r1", "r2"])
        let first = try XCTUnwrap(store.reports.first)
        XCTAssertEqual(first.name, "Blood panel")
        XCTAssertEqual(first.markers.count, 1)
        XCTAssertEqual(first.markers.first?.value, "42", "The value is kept as transcribed")
        XCTAssertEqual(first.extractionStatus, "manual")
        XCTAssertTrue(first.hasAttachment)
        XCTAssertTrue(AppStore(uiTesting: true).reports.isEmpty)
    }

    // MARK: - A demo never touches a real account

    @MainActor func testDemoRefusesToSaveAReportOrChangeAnAttachment() async throws {
        let store = makeStore(demo: true)
        let before = store.state
        let document = try NativeReports.report(name: "Demo panel", date: Date(),
                                                markers: [ReportMarker(name: "A", value: "1")])
        await store.saveReport(document)
        XCTAssertEqual(store.state, before)
        XCTAssertNotNil(store.reportError)
        XCTAssertTrue(store.reportError?.contains("演示") ?? false)

        store.reportError = nil
        let report = try XCTUnwrap(store.reports.first)
        await store.removeAttachment(from: report)
        XCTAssertEqual(store.state, before)
        XCTAssertNotNil(store.reportError)

        store.reportError = nil
        await store.deleteOrphanAttachment(Self.asset)
        XCTAssertEqual(store.state, before)

        // A demo never fetches real attachment bytes either.
        let data = await store.attachmentData(Self.asset)
        XCTAssertNil(data)
    }

    @MainActor func testAStillReferencedAttachmentIsNotDeletedAndSaysWhy() async {
        let store = makeStore(demo: false)
        await store.deleteOrphanAttachment(Self.asset)
        XCTAssertNotNil(store.reportError, "The service refuses this, so the app explains it first")
        XCTAssertTrue(ReportState.attachmentIsReferenced(store.state, assetId: Self.asset))
    }

    @MainActor func testAMalformedAttachmentIdIsNeverRequested() async {
        let store = makeStore(demo: false)
        XCTAssertNil(await store.attachmentData("not-an-id"))
        XCTAssertNil(await store.attachmentData(""))
    }

    // MARK: - Refusals read as something a person can act on

    @MainActor func testEveryReportRefusalGetsItsOwnReadableMessage() {
        let store = AppStore(uiTesting: true)
        let errors: [ReportError] = [.invalidName, .invalidDate, .invalidMarkerName, .invalidMarkerValue,
                                     .markerFieldTooLong, .tooManyMarkers, .emptyReport, .invalidAttachment]
        var seen = Set<String>()
        for error in errors {
            let message = store.reportMessage(error)
            XCTAssertFalse(message.isEmpty)
            XCTAssertFalse(message.contains("ReportError"), "A raw error name must not reach the user")
            XCTAssertTrue(seen.insert(message).inserted, "\(error) reuses another refusal's wording")
        }
        for status in [409, 404, 413] {
            let message = store.reportMessage(NativeAPIError.http(status, nil, nil))
            XCTAssertFalse(message.isEmpty)
            XCTAssertTrue(seen.insert(message).inserted, "status \(status) reuses another message")
        }
        XCTAssertEqual(store.reportMessage(NativeAPIError.http(401, nil, nil)),
                       store.message(NativeAPIError.http(401, nil, nil)))
    }

    // MARK: - The editor

    @MainActor func testANewReportNeedsANameAndOneCompleteMarkerBeforeItCanBeSaved() throws {
        var editor = ReportEditorFields()
        XCTAssertNil(editor.existing, "A new report has nothing to preserve")
        XCTAssertEqual(editor.markers.count, 1, "One blank row is offered to start")
        XCTAssertFalse(editor.canSave, "A blank report cannot be saved")

        editor.name = "Blood panel"
        XCTAssertFalse(editor.canSave, "A name alone is not a report")
        editor.markers[0].name = "Ferritin"
        XCTAssertFalse(editor.canSave, "A marker without its value is incomplete")
        editor.markers[0].value = "42"
        XCTAssertTrue(editor.canSave)

        let document = try editor.build()
        XCTAssertEqual(document["name"].stringValue, "Blood panel")
        XCTAssertEqual(document["extractionStatus"].stringValue, "manual")
        XCTAssertNil(document.objectValue?["assetId"])
        XCTAssertEqual(document["markers"].arrayValue?.count, 1)

        editor.name = "   "
        XCTAssertFalse(editor.canSave, "Whitespace is not a name")
    }

    @MainActor func testEditingAnExistingReportKeepsItsIdAttachmentDayAndCreatedAt() throws {
        let store = makeStore(demo: false)
        let report = try XCTUnwrap(store.reports.first)
        var editor = ReportEditorFields(report: report)
        XCTAssertEqual(editor.id, "r1")
        XCTAssertEqual(editor.name, "Blood panel")
        XCTAssertEqual(editor.markers.count, 1)
        XCTAssertEqual(editor.markers[0].unit, "ng/mL")

        editor.markers[0].value = "48"
        let document = try editor.build()
        XCTAssertEqual(document["id"].stringValue, "r1", "An edit updates the record, not a copy")
        XCTAssertEqual(document["assetId"].stringValue, Self.asset, "The original stays attached")
        XCTAssertEqual(document["date"].stringValue, "2026-10-20", "Its own day does not move")
        XCTAssertEqual(document["createdAt"].stringValue, "2026-10-20T08:00:00.000Z")
        XCTAssertEqual(document["markers"].arrayValue?[0]["value"].stringValue, "48")
    }

    @MainActor func testAnAttachmentOnlyReportOffersARowAndCannotBeSavedUntilItIsFilled() throws {
        let store = makeStore(demo: false)
        let report = try XCTUnwrap(store.reports.last)
        XCTAssertTrue(report.markers.isEmpty)
        var editor = ReportEditorFields(report: report)
        XCTAssertEqual(editor.markers.count, 1, "A blank row is offered so markers can be added")
        // It already has an attachment, so even the blank draft is a valid report.
        XCTAssertTrue(editor.canSave)
        editor.markers[0].notes = "started but unnamed"
        XCTAssertFalse(editor.canSave, "A started row must be completed, not silently dropped")
        editor.markers[0].name = "Ferritin"
        editor.markers[0].value = "42"
        XCTAssertTrue(editor.canSave)
        XCTAssertEqual(try editor.build()["assetId"].stringValue, Self.asset)
    }
}
