import Foundation

/// Value-only provenance: tests can map unsaved synthetic samples without inventing real Health sources.
struct HealthSampleSource {
    let id: String
    let name: String
    let productType: String?
}
