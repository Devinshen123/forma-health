import Foundation
import Security
import FormaCore

struct SavedSession: Codable {
    let server: String
    let user: FormaUser
    let token: String
    let expires: Date

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
    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "Forma.session.v1",
         kSecAttrAccount as String: "current"]
    }
    static func load() -> SavedSession? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(SavedSession.self, from: data)
    }
    static func save(_ value: SavedSession) throws {
        let data = try JSONEncoder().encode(value)
        clear()
        var q = query
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(q as CFDictionary, nil) == errSecSuccess else { throw NativeAPIError.invalidSession }
    }
    static func clear() { SecItemDelete(query as CFDictionary) }
}
