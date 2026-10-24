import Foundation
import XCTest
import HealthKit
import FormaCore
@testable import Forma

/// Synthetic HKSample construction only: no Health store reads or authorization prompts.
final class HealthSampleMapperTests: XCTestCase {
    private let source = HealthSampleSource(id: "test.synthetic.watch", name: "Synthetic Watch", productType: "Synthetic")

    func testSDNNUsesMillisecondsAndStableSampleUUID() throws {
        let date = Date(timeIntervalSince1970: 1_792_699_200)
        let sample = HKQuantitySample(type: HKQuantityType(.heartRateVariabilitySDNN),
                                      quantity: HKQuantity(unit: .second(), doubleValue: 0.042), start: date, end: date)
        let first = try HealthSampleMapper.record(sample, source: source)
        XCTAssertEqual(first.id, sample.uuid.uuidString.lowercased())
        XCTAssertEqual(first.kind, "hrv_sdnn")
        XCTAssertEqual(first.unit, "ms")
        XCTAssertEqual(try XCTUnwrap(first.value), 42, accuracy: 0.00001)
        XCTAssertEqual(first.sourceID, "test.synthetic.watch")
        XCTAssertEqual(first, try HealthSampleMapper.record(sample, source: source))
    }

    func testSleepStagesAreIndividualIntervalsRatherThanSummedTotals() throws {
        let date = Date(timeIntervalSince1970: 1_792_699_200)
        let sample = HKCategorySample(type: HKCategoryType(.sleepAnalysis),
                                     value: HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                                     start: date, end: date.addingTimeInterval(1800))
        let record = try HealthSampleMapper.record(sample, source: source)
        XCTAssertEqual(record.kind, "sleep")
        XCTAssertEqual(record.value, 30)
        XCTAssertEqual(record.unit, "min")
        XCTAssertEqual(record.metadata["sleepStage"], .string("asleep_core"))
    }

    func testMissingHealthKitProvenanceFailsClosedWithoutDefaultAppSource() {
        XCTAssertThrowsError(try HealthSampleMapper.provenance(nil))
        let date = Date(timeIntervalSince1970: 1_792_699_200)
        let unsaved = HKQuantitySample(type: HKQuantityType(.stepCount),
                                      quantity: HKQuantity(unit: .count(), doubleValue: 20), start: date, end: date)
        XCTAssertThrowsError(try HealthSampleMapper.record(unsaved))
    }

    @MainActor func testSessionClearImmediatelyInvalidatesPendingHealthConsent() {
        let store = AppStore(uiTesting: true)
        store.appleHealth.uploadConsent = true
        store.clearLocal()
        XCTAssertFalse(store.appleHealth.uploadConsent)
        XCTAssertTrue(store.appleHealth.pages.isEmpty)
        XCTAssertThrowsError(try store.healthImportSession())
    }
}
