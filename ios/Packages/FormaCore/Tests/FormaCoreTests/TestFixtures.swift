import Foundation
import XCTest
@testable import FormaCore

enum TestFixtures {
    static func load(_ name: String) throws -> JSONValue {
        let url = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "json"))
        return try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
    }

    static func date(_ instant: String) throws -> Date {
        try XCTUnwrap(RecordDates.parseInstant(instant))
    }

    static func replacing(_ value: JSONValue, _ changes: [String: JSONValue]) -> JSONValue {
        var object = value.objectValue ?? [:]
        for (key, replacement) in changes { object[key] = replacement }
        return .object(object)
    }
}
