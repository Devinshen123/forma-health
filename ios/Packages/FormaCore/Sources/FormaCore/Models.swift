import Foundation

public struct FormaUser: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let email: String
    public let name: String

    public init(id: String, email: String, name: String) {
        self.id = id
        self.email = email
        self.name = name
    }
}

public struct SyncSnapshot: Codable, Equatable, Sendable {
    public let state: JSONValue
    public let revision: Int
    public let entityVersions: [String: Int]

    public init(state: JSONValue, revision: Int, entityVersions: [String: Int]) {
        self.state = state
        self.revision = revision
        self.entityVersions = entityVersions
    }
}
