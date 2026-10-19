import Foundation
import Security
import FormaCore

struct SavedSession: Codable {
    let server: String
    let user: FormaUser
    let token: String
    let expires: Date
    let webStoreID: UUID

    init(server: String, user: FormaUser, token: String, expires: Date, webStoreID: UUID = UUID()) {
        self.server = server; self.user = user; self.token = token; self.expires = expires; self.webStoreID = webStoreID
    }

    func cookie(for url: URL) -> HTTPCookie? {
        guard expires > Date(), token.count == 64,
              token.allSatisfy({ $0.isHexDigit }), let host = url.host else { return nil }
        var properties: [HTTPCookiePropertyKey: Any] = [
            .name: "forma_session", .value: token, .domain: host, .path: "/", .expires: expires,
            HTTPCookiePropertyKey("HttpOnly"): "TRUE"
        ]
        if url.scheme == "https" { properties[.secure] = "TRUE" }
        return HTTPCookie(properties: properties)
    }
}

enum SessionVault {
    private static let clearKey = "forma.session.pending-signout.v1"
    static var hasPendingClear: Bool { UserDefaults.standard.string(forKey: clearKey) != nil }
    static var pendingProfileID: UUID? { UserDefaults.standard.string(forKey: clearKey).flatMap(UUID.init(uuidString:)) }
    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "Forma.session.v1",
         kSecAttrAccount as String: "current"]
    }
    static func load() -> SavedSession? {
        guard !hasPendingClear else { return nil }
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(SavedSession.self, from: data)
    }
    static func save(_ value: SavedSession) throws {
        guard !hasPendingClear else { throw NativeAPIError.invalidSession }
        let data = try JSONEncoder().encode(value)
        let updates: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        let updated = SecItemUpdate(query as CFDictionary, updates as CFDictionary)
        if updated == errSecSuccess { return }
        guard updated == errSecItemNotFound else { throw NativeAPIError.invalidSession }
        var q = query
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(q as CFDictionary, nil) == errSecSuccess else { throw NativeAPIError.invalidSession }
    }
    /// This UUID-only intent blocks restore even if deletion fails or the app stops mid-cleanup.
    static func beginClear(profileID: UUID?) {
        UserDefaults.standard.set(profileID?.uuidString ?? "none", forKey: clearKey)
    }
    static func clearPendingCredentials() throws {
        guard hasPendingClear else { return }
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw NativeAPIError.invalidSession }
    }
    static func completeClear() { UserDefaults.standard.removeObject(forKey: clearKey) }
}
