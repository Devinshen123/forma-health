import XCTest
import FormaCore
@testable import Forma

final class NativeAPITests: XCTestCase {
    @MainActor func testRestoredSessionCookieIsHttpOnlySecureAndOriginScoped() throws {
        let user = FormaUser(id: UUID().uuidString.lowercased(), email: "synthetic@example.test", name: "Synthetic")
        let saved = SavedSession(server: "https://forma.example", user: user, token: String(repeating: "a", count: 64), expires: Date().addingTimeInterval(3600))
        let restored = try JSONDecoder().decode(SavedSession.self, from: JSONEncoder().encode(saved))
        XCTAssertEqual(restored.webStoreID, saved.webStoreID)
        let cookie = try XCTUnwrap(restored.cookie(for: URL(string: saved.server)!))
        XCTAssertTrue(cookie.isHTTPOnly)
        XCTAssertTrue(cookie.isSecure)
        XCTAssertEqual(cookie.path, "/")
        XCTAssertEqual(cookie.domain, "forma.example")
        let expired = SavedSession(server: saved.server, user: user, token: saved.token, expires: Date().addingTimeInterval(-1))
        XCTAssertNil(expired.cookie(for: URL(string: saved.server)!))
    }
    @MainActor func testRealNativeTransportRoundTripsThroughTheExistingServer() async throws {
        guard ProcessInfo.processInfo.environment["FORMA_LIVE_API"] == "YES" else {
            throw XCTSkip("Run the ephemeral local API and pass FORMA_LIVE_API=YES to xcodebuild for this integration case.")
        }
        let api = NativeAPI(baseURL: try NativeAPI.server("http://127.0.0.1:3001"))
        defer { api.invalidate() }
        let signedIn = try await api.json("/api/auth/register", method: "POST", body: .object([
            "email": .string("ios-\(UUID().uuidString.lowercased())@example.test"),
            "password": .string("Synthetic native integration 2026"), "name": .string("Synthetic iPhone")
        ]))
        let account = try XCTUnwrap(signedIn["user"]["id"].stringValue)
        XCTAssertNotNil(api.cookie)
        XCTAssertTrue(api.cookie?.isHTTPOnly == true)
        let me = try await api.json("/api/auth/me")
        XCTAssertEqual(me["user"]["id"].stringValue, account)
        let blank = try await api.json("/api/sync", account: account)
        XCTAssertEqual(blank["state"]["meals"].arrayValue, [])
        let meal = try NativeRecords.meal(name: "Synthetic live meal", date: Date(), grams: 150, kcal: 250, protein: 20, carbs: 30, fat: 5, type: "lunch")
        let id = try XCTUnwrap(meal["id"].stringValue)
        let mutation: JSONValue = .object([
            "mutationId": .string(UUID().uuidString.lowercased()),
            "changes": .array([.object(["collection": .string("meals"), "id": .string(id), "baseVersion": .number(0), "kind": .string("upsert"), "value": meal])])
        ])
        let saved = try await api.json("/api/sync", method: "POST", body: mutation, account: account)
        XCTAssertEqual(saved["state"]["meals"].arrayValue, [meal])
        let retry = try await api.json("/api/sync", method: "POST", body: mutation, account: account)
        XCTAssertEqual(saved["revision"], retry["revision"])
        XCTAssertEqual(retry["state"]["meals"].arrayValue?.count, 1)
        do {
            _ = try await api.json("/api/sync", account: UUID().uuidString.lowercased())
            XCTFail("Cross-account hint accepted")
        } catch NativeAPIError.http(let status, _, _) { XCTAssertEqual(status, 401) }
        _ = try await api.json("/api/auth/logout", method: "POST", body: .object([:]), account: account)
        let loggedOut = try await api.json("/api/auth/me")
        XCTAssertEqual(loggedOut["user"], .null)
    }
    @MainActor func testDisplayedMissingZeroAndSmallPositiveValuesStayDistinct() {
        XCTAssertEqual(FeatureFormat.number(nil, language: "zh"), "—")
        XCTAssertEqual(FeatureFormat.number(0, language: "en"), "0")
        XCTAssertEqual(FeatureFormat.number(0.000001, language: "en"), "<0.001")
        XCTAssertEqual(FeatureFormat.number(0.04, language: "zh"), "<0.1")
        XCTAssertEqual(FeatureFormat.number(0.1, language: "en"), "0.1")
    }
    @MainActor func testOnlyServerOriginsCanReceiveCredentials() throws {
        XCTAssertEqual(try NativeAPI.server("https://forma.example").absoluteString, "https://forma.example")
        for invalid in ["http://forma.example", "https://name:secret@forma.example", "https://forma.example/api", "https://forma.example?token=secret", "https://forma.example#login", "file:///tmp/forma"] {
            XCTAssertThrowsError(try NativeAPI.server(invalid))
        }
    }

    @MainActor func testAccountOriginCookieAndExactMutationReachOneOrigin() async throws {
        let url = try NativeAPI.server("https://forma.example")
        let cookie = HTTPCookie(properties: [.name: "forma_session", .value: String(repeating: "a", count: 64), .domain: "forma.example", .path: "/", .secure: "TRUE"])!
        let body: JSONValue = .object(["mutationId": .string("synthetic-mutation"), "changes": .array([])])
        StubProtocol.handler = { request in
            XCTAssertEqual(request.url?.absoluteString, "https://forma.example/api/sync")
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Origin"), "https://forma.example")
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Forma-Account"), "synthetic-account")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Cookie"), "forma_session=" + String(repeating: "a", count: 64))
            XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
            var data = request.httpBody
            if data == nil, let stream = request.httpBodyStream {
                stream.open(); defer { stream.close() }
                var buffer = [UInt8](repeating: 0, count: 4096)
                var result = Data()
                while stream.hasBytesAvailable {
                    let count = stream.read(&buffer, maxLength: buffer.count)
                    if count <= 0 { break }
                    result.append(buffer, count: count)
                }
                data = result
            }
            XCTAssertEqual(try JSONDecoder().decode(JSONValue.self, from: XCTUnwrap(data)), body)
            return (200, ["Content-Type": "application/json"], Data("{\"ok\":true}".utf8))
        }
        let api = NativeAPI(baseURL: url, cookie: cookie, protocolClasses: [StubProtocol.self])
        defer { api.invalidate(); StubProtocol.handler = nil }
        let result = try await api.json("/api/sync", method: "POST", body: body, account: "synthetic-account")
        XCTAssertEqual(result["ok"].boolValue, true)
        do { _ = try await api.send("//other.example/api"); XCTFail("Cross-origin path accepted") } catch { }
    }

    @MainActor func testServerCookieAndConflictRetainNoRawErrorText() async throws {
        let api = NativeAPI(baseURL: URL(string: "https://forma.example")!, protocolClasses: [StubProtocol.self])
        defer { api.invalidate(); StubProtocol.handler = nil }
        StubProtocol.handler = { _ in
            (200, ["Set-Cookie": "forma_session=" + String(repeating: "b", count: 64) + "; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Strict"], Data("{\"user\":null}".utf8))
        }
        _ = try await api.json("/api/auth/me")
        XCTAssertEqual(api.cookie?.value, String(repeating: "b", count: 64))
        XCTAssertTrue(api.cookie?.isHTTPOnly == true)
        StubProtocol.handler = { _ in (409, [:], Data("{\"error\":\"private health contents\",\"code\":\"SYNC_CONFLICT\"}".utf8)) }
        do { _ = try await api.json("/api/sync"); XCTFail("Conflict accepted") }
        catch NativeAPIError.http(let status, let code, _) { XCTAssertEqual(status, 409); XCTAssertEqual(code, "SYNC_CONFLICT") }
        catch { XCTFail("Wrong error type") }
        api.invalidate()
        do { _ = try await api.send("/api/auth/me"); XCTFail("Invalidated session accepted") } catch NativeAPIError.staleSession { }
    }
}

private final class StubProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (Int, [String: String], Data))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            let (status, headers, data) = try XCTUnwrap(Self.handler)(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: headers)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}
