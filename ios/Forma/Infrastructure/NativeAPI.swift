import Foundation
import FormaCore

enum NativeAPIError: Error {
    case invalidServer, invalidSession, malformedResponse, staleSession
    case http(Int, String?, JSONValue?)
}

/// A private in-memory session; never uses the process-wide cookie or response cache.
@MainActor
final class NativeAPI: NSObject, URLSessionTaskDelegate {
    let baseURL: URL
    private(set) var cookie: HTTPCookie?
    private var valid = true
    private let protocols: [AnyClass]?
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieStorage = nil
        config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 20
        config.timeoutIntervalForResource = 40
        if let protocols { config.protocolClasses = protocols }
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    init(baseURL: URL, cookie: HTTPCookie? = nil, protocolClasses: [AnyClass]? = nil) {
        self.baseURL = baseURL
        self.cookie = cookie
        self.protocols = protocolClasses
    }

    static func server(_ input: String) throws -> URL {
        guard let parts = URLComponents(string: input.trimmingCharacters(in: .whitespacesAndNewlines)),
              let host = parts.host, !host.isEmpty,
              parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
              parts.path.isEmpty || parts.path == "/" else { throw NativeAPIError.invalidServer }
        var allowed = parts.scheme == "https"
        #if DEBUG
        // Local test server only; never send credentials over arbitrary HTTP.
        if parts.scheme == "http" && ["localhost", "127.0.0.1", "::1"].contains(host) { allowed = true }
        #endif
        guard allowed, let url = URL(string: "\(parts.scheme!)://\(parts.percentEncodedHost!)\(parts.port.map { ":\($0)" } ?? "")") else {
            throw NativeAPIError.invalidServer
        }
        return url
    }

    func invalidate() {
        valid = false
        cookie = nil
        session.invalidateAndCancel()
    }

    nonisolated func urlSession(_ session: URLSession, task: URLSessionTask,
                               willPerformHTTPRedirection response: HTTPURLResponse,
                               newRequest request: URLRequest,
                               completionHandler: @escaping (URLRequest?) -> Void) {
        // Credential-bearing requests never follow redirects to a different host or login page.
        completionHandler(nil)
    }

    func send(_ path: String, method: String = "GET", body: JSONValue? = nil,
              account: String? = nil) async throws -> Data {
        guard valid, path.hasPrefix("/"), !path.hasPrefix("//"),
              let url = URL(string: path, relativeTo: baseURL)?.absoluteURL,
              url.host == baseURL.host, url.scheme == baseURL.scheme, url.port == baseURL.port else {
            throw NativeAPIError.staleSession
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(baseURL.absoluteString, forHTTPHeaderField: "Origin")
        if let account { request.setValue(account, forHTTPHeaderField: "X-Forma-Account") }
        if let cookie { request.setValue("\(cookie.name)=\(cookie.value)", forHTTPHeaderField: "Cookie") }
        if let body { request.httpBody = try JSONEncoder().encode(body) }
        let (data, response) = try await session.data(for: request)
        guard valid else { throw NativeAPIError.staleSession }
        guard let response = response as? HTTPURLResponse else { throw NativeAPIError.malformedResponse }
        guard (200..<300).contains(response.statusCode) else {
            let value = try? JSONDecoder().decode(JSONValue.self, from: data)
            throw NativeAPIError.http(response.statusCode, value?["code"].stringValue, value?["snapshot"])
        }
        let headers = response.allHeaderFields.reduce(into: [String: String]()) { result, pair in
            if let key = pair.key as? String { result[key] = String(describing: pair.value) }
        }
        if let updated = HTTPCookie.cookies(withResponseHeaderFields: headers, for: baseURL)
            .first(where: { $0.name == "forma_session" && $0.path == "/" }) { cookie = updated }
        return data
    }

    func json(_ path: String, method: String = "GET", body: JSONValue? = nil,
              account: String? = nil) async throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: await send(path, method: method, body: body, account: account))
    }
}
