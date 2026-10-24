import Foundation

@MainActor
struct HealthImportSession {
    let generation: UUID
    let account: String
    let client: NativeAPI
    var namespace: String { client.baseURL.absoluteString + "\n" + account }
}
