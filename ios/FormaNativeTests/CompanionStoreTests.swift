import XCTest
import FormaCore
@testable import Forma

/// Synthetic only: an isolated demo store plus a stubbed transport. No account, Keychain,
/// deployed service or real health record is touched.
final class CompanionStoreTests: XCTestCase {

    // MARK: - Demo mode never reaches a real account

    @MainActor private func demoStore() -> AppStore {
        let store = AppStore(uiTesting: true)
        store.enterDemo()
        return store
    }

    @MainActor func testEnteringDemoSeedsTheSharedDemoCompanion() {
        let store = demoStore()
        XCTAssertTrue(store.isDemo)
        let companion = store.companion
        XCTAssertEqual(companion?.character, .sprout)
        XCTAssertEqual(companion?.xp, 140)
        XCTAssertEqual(companion?.level, 2)
        XCTAssertEqual(companion?.activeDays, 6)
        XCTAssertEqual(companion?.equipped, .leaf)
        XCTAssertEqual(companion?.inventory, [.leaf])
        XCTAssertEqual(companion?.chests.count, 2)
        XCTAssertNil(companion?.challenge)
        XCTAssertEqual(companion?.day, companionDay())
    }

    @MainActor func testDemoClaimRefusesToSaveAndLeavesProgressUntouched() async {
        let store = demoStore()
        let before = store.companion
        await store.claimCompanion()
        XCTAssertEqual(store.companion, before, "A demo claim must never change progress")
        XCTAssertNotNil(store.companionError)
        XCTAssertTrue(store.companionError?.contains("演示") ?? false)
        await store.claimCompanion(rest: true)
        XCTAssertEqual(store.companion, before)
        await store.companionChallenge(.create)
        XCTAssertEqual(store.companion, before, "A demo challenge must never change progress")
        XCTAssertNotNil(store.companionError)
    }

    @MainActor func testDemoWardrobeRefusesAnUnownedItemAndTogglesAnOwnedOne() async {
        let store = demoStore()
        XCTAssertEqual(store.companion?.inventory, [.leaf])
        await store.equipCompanion(.crown)
        XCTAssertEqual(store.companion?.equipped, .leaf, "An unowned item must not be equipped")
        XCTAssertNotNil(store.companionError)
        await store.equipCompanion(nil)
        XCTAssertNil(store.companion?.equipped)
        XCTAssertNil(store.companionError)
        await store.equipCompanion(.leaf)
        XCTAssertEqual(store.companion?.equipped, .leaf)
    }

    @MainActor func testDemoCharacterSwitchKeepsXPWardrobeAndRewards() async {
        let store = demoStore()
        let before = store.companion
        await store.selectCompanionCharacter(.seal)
        XCTAssertEqual(store.companion?.character, .seal)
        XCTAssertEqual(store.companion?.xp, before?.xp)
        XCTAssertEqual(store.companion?.level, before?.level)
        XCTAssertEqual(store.companion?.activeDays, before?.activeDays)
        XCTAssertEqual(store.companion?.inventory, before?.inventory)
        XCTAssertEqual(store.companion?.equipped, before?.equipped)
        XCTAssertEqual(store.companion?.chests, before?.chests)
    }

    @MainActor func testDemoChestOpensOnceAndAwardsTheMilestoneItem() async {
        let store = demoStore()
        await store.openCompanionChest(id: "demo-6")
        XCTAssertEqual(store.companion?.inventory, [.leaf, .cap])
        let opened = store.companion
        await store.openCompanionChest(id: "demo-6")
        XCTAssertEqual(store.companion, opened, "A second open must not award another item")
        await store.openCompanionChest(id: "demo-3")
        XCTAssertEqual(store.companion, opened, "An already-open chest stays as it is")
    }

    @MainActor func testSigningOutClearsTheCompanionSnapshot() async {
        let store = demoStore()
        XCTAssertNotNil(store.companion)
        await store.logout()
        XCTAssertNil(store.companion)
        XCTAssertNil(store.companionError)
        XCTAssertFalse(store.companionBusy)
    }

    // MARK: - Input the service would reject is rejected before any request

    @MainActor func testInvitationCodesAreNormalisedExactlyAsTheServiceDoes() {
        XCTAssertEqual(AppStore.companionChallengeCode("0123456789abcdef"), "0123456789ABCDEF")
        XCTAssertEqual(AppStore.companionChallengeCode("  0123456789ABCDEF \n"), "0123456789ABCDEF")
        XCTAssertNil(AppStore.companionChallengeCode(""))
        XCTAssertNil(AppStore.companionChallengeCode("0123456789ABCDE"), "15 characters")
        XCTAssertNil(AppStore.companionChallengeCode("0123456789ABCDEF0"), "17 characters")
        XCTAssertNil(AppStore.companionChallengeCode("0123456789ABCDEG"), "G is not hexadecimal")
        XCTAssertNil(AppStore.companionChallengeCode("0123456789ABCDE "), "an inner space is not trimmed away")
        XCTAssertNil(AppStore.companionChallengeCode("٠١٢٣٤٥٦٧٨٩ABCDEF"), "other Unicode digits are not hexadecimal")
    }

    @MainActor func testAServiceSuppliedChestIdCannotReshapeTheRequestPath() {
        XCTAssertEqual(AppStore.companionPathComponent("demo-6"), "demo-6")
        XCTAssertEqual(AppStore.companionPathComponent("a1B2_c3-d4"), "a1B2_c3-d4")
        XCTAssertNil(AppStore.companionPathComponent(""))
        XCTAssertNil(AppStore.companionPathComponent("../../api/account"))
        XCTAssertNil(AppStore.companionPathComponent("a/b"))
        XCTAssertNil(AppStore.companionPathComponent("a?b=1"))
        XCTAssertNil(AppStore.companionPathComponent("a b"))
        XCTAssertNil(AppStore.companionPathComponent("a#b"))
    }

    @MainActor func testEveryCompanionErrorCodeGetsItsOwnReadableMessage() {
        let store = AppStore(uiTesting: true)
        var seen = Set<String>()
        for code in ["CHEST_NOT_FOUND", "ITEM_NOT_OWNED", "CHALLENGE_ACTIVE", "CHALLENGE_UNAVAILABLE", "CHALLENGE_RATE_LIMIT"] {
            let message = store.companionMessage(NativeAPIError.http(409, code, nil))
            XCTAssertFalse(message.isEmpty)
            XCTAssertFalse(message.contains(code), "The raw code must not be shown to the user")
            XCTAssertTrue(seen.insert(message).inserted, "\(code) reuses another code's message")
        }
        // An unmapped failure falls back to the existing shared wording.
        XCTAssertEqual(store.companionMessage(NativeAPIError.http(401, nil, nil)),
                       store.message(NativeAPIError.http(401, nil, nil)))
        XCTAssertEqual(store.companionMessage(NativeAPIError.invalidSession),
                       store.message(NativeAPIError.invalidSession))
    }

    // MARK: - The wire contract, against a stubbed transport

    @MainActor func testCompanionRequestsMatchTheServiceContractExactly() async throws {
        let url = try NativeAPI.server("https://forma.example")
        let api = NativeAPI(baseURL: url, protocolClasses: [CompanionStubProtocol.self])
        defer { api.invalidate(); CompanionStubProtocol.handler = nil }

        let recorder = CompanionCallRecorder()
        CompanionStubProtocol.handler = { request in
            recorder.record(path: request.url?.path ?? "", method: request.httpMethod ?? "",
                            body: CompanionStubProtocol.body(of: request))
            return (200, ["Content-Type": "application/json"], Data(Self.snapshotJSON.utf8))
        }

        _ = try await api.send("/api/companion", account: "synthetic-account")
        _ = try await api.send("/api/companion/claim", method: "POST", body: .object([:]), account: "synthetic-account")
        _ = try await api.send("/api/companion/rest", method: "POST", body: .object([:]), account: "synthetic-account")
        _ = try await api.send("/api/companion/chests/demo-6/open", method: "POST", body: .object([:]), account: "synthetic-account")
        _ = try await api.send("/api/companion/equipment", method: "PUT", body: .object(["item": .string("leaf")]), account: "synthetic-account")
        _ = try await api.send("/api/companion/equipment", method: "PUT", body: .object(["item": .null]), account: "synthetic-account")
        _ = try await api.send("/api/companion/character", method: "PUT", body: .object(["character": .string("seal")]), account: "synthetic-account")
        _ = try await api.send("/api/companion/challenges", method: "POST",
                               body: .object(["action": .string("join"), "code": .string("0123456789ABCDEF")]),
                               account: "synthetic-account")

        let seen = recorder.calls
        XCTAssertEqual(seen.map(\.path), [
            "/api/companion", "/api/companion/claim", "/api/companion/rest",
            "/api/companion/chests/demo-6/open", "/api/companion/equipment", "/api/companion/equipment",
            "/api/companion/character", "/api/companion/challenges",
        ])
        XCTAssertEqual(seen.map(\.method), ["GET", "POST", "POST", "POST", "PUT", "PUT", "PUT", "POST"])
        // The service parses claim, rest and chest bodies with a strict empty object.
        XCTAssertEqual(seen[1].body, .object([:]))
        XCTAssertEqual(seen[2].body, .object([:]))
        XCTAssertEqual(seen[3].body, .object([:]))
        XCTAssertEqual(seen[4].body, .object(["item": .string("leaf")]))
        XCTAssertEqual(seen[5].body, .object(["item": .null]), "Taking an item off sends an explicit null")
        XCTAssertEqual(seen[6].body, .object(["character": .string("seal")]))
        XCTAssertEqual(seen[7].body, .object(["action": .string("join"), "code": .string("0123456789ABCDEF")]))
    }

    @MainActor func testServiceSnapshotDecodesAndRefusalsKeepTheirCode() async throws {
        let api = NativeAPI(baseURL: try NativeAPI.server("https://forma.example"),
                            protocolClasses: [CompanionStubProtocol.self])
        defer { api.invalidate(); CompanionStubProtocol.handler = nil }

        CompanionStubProtocol.handler = { _ in (200, ["Content-Type": "application/json"], Data(Self.snapshotJSON.utf8)) }
        let data = try await api.send("/api/companion", account: "synthetic-account")
        let snapshot = try JSONDecoder().decode(CompanionSnapshot.self, from: data)
        XCTAssertEqual(snapshot.character, .otter)
        XCTAssertEqual(snapshot.xp, 140)
        XCTAssertEqual(snapshot.level, 2)
        XCTAssertEqual(snapshot.equipped, .leaf)
        XCTAssertEqual(snapshot.challenge?.participants.first?.days, 4)

        CompanionStubProtocol.handler = { _ in
            (409, [:], Data("{\"error\":\"Open the matching milestone chest before equipping this item\",\"code\":\"ITEM_NOT_OWNED\"}".utf8))
        }
        do {
            _ = try await api.send("/api/companion/equipment", method: "PUT",
                                   body: .object(["item": .string("crown")]), account: "synthetic-account")
            XCTFail("An unowned item was accepted")
        } catch NativeAPIError.http(let status, let code, _) {
            XCTAssertEqual(status, 409)
            XCTAssertEqual(code, "ITEM_NOT_OWNED")
        }
    }

    private static let snapshotJSON = """
    {"ruleVersion":1,"character":"otter","day":"2026-10-22","xp":140,"level":2,"activeDays":6,
     "equipped":"leaf","inventory":["leaf"],
     "quests":[{"id":"nutrition","completed":true,"xp":10},{"id":"movement","completed":false,"xp":10},
               {"id":"sleep","completed":true,"xp":10}],
     "chests":[{"id":"demo-3","milestone":3,"item":"leaf","openedAt":"2026-10-18T00:00:00Z"},
               {"id":"demo-6","milestone":6,"item":null,"openedAt":null}],
     "challenge":{"id":"ch1","code":"0123456789ABCDEF","startsAt":"2026-10-20T00:00:00Z",
                  "endsAt":"2026-10-27T00:00:00Z","participants":[{"self":true,"days":4},{"self":false,"days":2}]}}
    """
}

/// The stub runs on a URLSession thread, so recording is guarded rather than left to chance.
private final class CompanionCallRecorder {
    struct Call {
        let path: String
        let method: String
        let body: JSONValue?
    }

    private let lock = NSLock()
    private var recorded: [Call] = []

    var calls: [Call] {
        lock.lock()
        defer { lock.unlock() }
        return recorded
    }

    func record(path: String, method: String, body: JSONValue?) {
        lock.lock()
        defer { lock.unlock() }
        recorded.append(Call(path: path, method: method, body: body))
    }
}

private final class CompanionStubProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (Int, [String: String], Data))?

    /// URLSession may hand the body over as a stream rather than `httpBody`.
    static func body(of request: URLRequest) -> JSONValue? {
        var data = request.httpBody
        if data == nil, let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var buffer = [UInt8](repeating: 0, count: 4096)
            var result = Data()
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                result.append(buffer, count: count)
            }
            data = result
        }
        guard let data, !data.isEmpty else { return nil }
        return try? JSONDecoder().decode(JSONValue.self, from: data)
    }

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
