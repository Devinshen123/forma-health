import XCTest
import FormaCore
@testable import Forma

final class NativeAPITests: XCTestCase {
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
