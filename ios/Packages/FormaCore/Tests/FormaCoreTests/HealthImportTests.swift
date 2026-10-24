import Foundation
import XCTest
@testable import FormaCore

final class HealthImportTests: XCTestCase {
    private func record(id: UUID = UUID(), value: Double? = 0, kind: String = "steps", unit: String = "count") throws -> HealthImportRecord {
        try HealthImportRecord(id: id, kind: kind, start: Date(timeIntervalSince1970: 1_792_699_200),
                               end: Date(timeIntervalSince1970: 1_792_699_260), value: value, unit: unit,
                               sourceID: "test.synthetic.watch", sourceName: "Synthetic Watch",
                               metadata: ["synthetic": .bool(true)])
    }

    func testUUIDReplayUnknownZeroAndSDNNStayDistinct() throws {
        let id = UUID()
        let first = try record(id: id)
        XCTAssertEqual(first, try record(id: id))
        XCTAssertEqual(first.json["id"].stringValue, id.uuidString.lowercased())
        XCTAssertEqual(first.json["value"], .number(0))
        XCTAssertEqual(try record(value: nil).json["value"], .null)
        XCTAssertEqual(try record(value: 42, kind: "hrv_sdnn", unit: "ms").json["kind"], .string("hrv_sdnn"))
        XCTAssertThrowsError(try record(value: 42, kind: "hrv_rmssd", unit: "ms"))
        XCTAssertThrowsError(try record(value: .nan))
        XCTAssertThrowsError(try record(value: .infinity))
        XCTAssertThrowsError(try record(value: -1))
        XCTAssertThrowsError(try record(unit: "bpm"))
        XCTAssertEqual(first.json["source"]["sourceId"], .string("test.synthetic.watch"))
        XCTAssertEqual(first.json["metadata"]["synthetic"], .bool(true))
        XCTAssertNil(first.json["provider"].stringValue)
    }

    func testBatchBoundsDoNotDropAddsDeletionsOrRevision() throws {
        let records = try (0..<401).map { try record(value: Double($0)) }
        let deletes = (0..<202).map { _ in UUID().uuidString.lowercased() }
        let batches = HealthImportBatch.payloads(records: records, deletedIDs: deletes, expectedRevision: 7)
        XCTAssertEqual(batches.count, 4)
        for batch in batches {
            XCTAssertEqual(batch["consent"], .bool(true))
            XCTAssertEqual(batch["expectedRevision"], .number(7))
            XCTAssertLessThanOrEqual((batch["records"].arrayValue?.count ?? 0) + (batch["deletedIds"].arrayValue?.count ?? 0), 200)
        }
        XCTAssertEqual(batches.flatMap { $0["records"].arrayValue ?? [] }, records.map(\.json))
        XCTAssertEqual(batches.flatMap { $0["deletedIds"].arrayValue ?? [] }, deletes.map(JSONValue.string))
        XCTAssertEqual(batches, HealthImportBatch.payloads(records: records, deletedIDs: deletes, expectedRevision: 7))
    }

    func testEmptyCursorAcknowledgementHasExplicitConsentAndNoFabricatedRecords() {
        let payloads = HealthImportBatch.payloads(records: [], deletedIDs: [], expectedRevision: 0)
        XCTAssertEqual(payloads, [.object(["consent": .bool(true), "expectedRevision": .number(0), "records": .array([]), "deletedIds": .array([])])])
    }

    func testWireSerializationIsExactAndKeepsNull() throws {
        let payload = HealthImportBatch.payloads(records: [try record(value: nil)], deletedIDs: [], expectedRevision: 2)[0]
        let decoded = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(payload))
        XCTAssertEqual(decoded, payload)
        XCTAssertEqual(decoded["records"][0]["value"], .null)
        XCTAssertEqual(Set(try XCTUnwrap(decoded["records"][0].objectValue).keys),
                       Set(["id", "kind", "startTime", "endTime", "value", "unit", "source", "metadata"]))
    }
}
