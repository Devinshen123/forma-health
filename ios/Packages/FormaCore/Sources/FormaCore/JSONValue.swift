import Foundation

/// Reads the existing API without discarding fields that this client does not yet understand.
public enum JSONValue: Codable, Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self), value.isFinite {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .number(let value):
            guard value.isFinite else {
                throw EncodingError.invalidValue(value, .init(codingPath: encoder.codingPath, debugDescription: "JSON numbers must be finite"))
            }
            try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }

    public subscript(key: String) -> JSONValue { objectValue?[key] ?? .null }
    public subscript(index: Int) -> JSONValue {
        guard let array = arrayValue, array.indices.contains(index) else { return .null }
        return array[index]
    }

    public var stringValue: String? {
        guard case .string(let value) = self else { return nil }
        return value
    }
    public var doubleValue: Double? {
        guard case .number(let value) = self, value.isFinite else { return nil }
        return value
    }
    public var intValue: Int? {
        guard let value = doubleValue else { return nil }
        return Int(exactly: value)
    }
    public var boolValue: Bool? {
        guard case .bool(let value) = self else { return nil }
        return value
    }
    public var arrayValue: [JSONValue]? {
        guard case .array(let value) = self else { return nil }
        return value
    }
    public var objectValue: [String: JSONValue]? {
        guard case .object(let value) = self else { return nil }
        return value
    }
}
