import Foundation
import CryptoKit

struct HealthAnchorCheckpoint: Codable {
    let start: Date
    let anchor: Data
}

/// Only opaque cursors and the fixed query start persist. No sample values are cached on disk.
enum HealthAnchorVault {
    private static func location(namespace: String, type: String) throws -> URL {
        let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                   appropriateFor: nil, create: true)
            .appendingPathComponent("HealthAnchors", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                               attributes: [.protectionKey: FileProtectionType.complete])
        var protectedDirectory = directory
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try protectedDirectory.setResourceValues(values)
        let key = SHA256.hash(data: Data((namespace + "\n" + type).utf8))
            .map { String(format: "%02x", $0) }.joined()
        return directory.appendingPathComponent(key + ".json")
    }

    static func load(namespace: String, type: String) throws -> HealthAnchorCheckpoint? {
        let url = try location(namespace: namespace, type: type)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return try JSONDecoder().decode(HealthAnchorCheckpoint.self, from: Data(contentsOf: url))
    }

    static func save(_ checkpoint: HealthAnchorCheckpoint, namespace: String, type: String) throws {
        try JSONEncoder().encode(checkpoint).write(to: location(namespace: namespace, type: type),
                                                 options: [.atomic, .completeFileProtection])
    }

    static func reset(namespace: String, types: [String]) throws {
        for type in types {
            let url = try location(namespace: namespace, type: type)
            if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
        }
    }
}
