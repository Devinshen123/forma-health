import Foundation
import XCTest
@testable import FormaCore

final class JSONValueTests: XCTestCase {
    func testRoundTripPreservesUnknownFieldsAndNulls() throws {
        let raw = Data(#"{"number":1.25,"integer":42,"flag":true,"null":null,"text":"你好","future":{"items":[false,"new",3]}}"#.utf8)
        let decoded = try JSONDecoder().decode(JSONValue.self, from: raw)
        XCTAssertEqual(decoded["integer"].intValue, 42)
        XCTAssertEqual(decoded["number"].doubleValue, 1.25)
        XCTAssertEqual(decoded["flag"].boolValue, true)
        XCTAssertEqual(decoded["text"].stringValue, "你好")
        XCTAssertEqual(decoded["future"]["items"][0].boolValue, false)
        XCTAssertEqual(decoded["future"]["items"][1].stringValue, "new")
        XCTAssertEqual(try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(decoded)), decoded)
    }

    func testMissingAndWrongTypeRemainMissingRatherThanZero() {
        let json: JSONValue = .object(["zero": .number(0), "false": .bool(false), "text": .string("12"), "list": .array([.number(7)])])
        XCTAssertEqual(json["missing"], .null)
        XCTAssertEqual(json["missing"]["nested"], .null)
        XCTAssertEqual(json["list"][-1], .null)
        XCTAssertEqual(json["list"][1], .null)
        XCTAssertNil(json["missing"].doubleValue)
        XCTAssertNil(json["text"].doubleValue)
        XCTAssertNil(json["false"].intValue)
        XCTAssertNil(json["zero"].boolValue)
        XCTAssertEqual(json["zero"].doubleValue, 0)
        XCTAssertEqual(json["false"].boolValue, false)
        XCTAssertNil(JSONValue.number(1.5).intValue)
        XCTAssertNil(JSONValue.number(Double.greatestFiniteMagnitude).intValue)
        XCTAssertNil(JSONValue.number(.nan).doubleValue)
    }

    func testNonFiniteNumbersCannotBeEncoded() {
        for number in [Double.nan, Double.infinity, -Double.infinity] {
            XCTAssertThrowsError(try JSONEncoder().encode(JSONValue.number(number)))
        }
    }

    func testPublicModelsDecodeServerEnvelope() throws {
        let raw = Data(#"{"state":{"meals":[],"futureFeature":{"enabled":true}},"revision":7,"entityVersions":{"meals:abc":3},"ignored":"server metadata"}"#.utf8)
        let snapshot = try JSONDecoder().decode(SyncSnapshot.self, from: raw)
        XCTAssertEqual(snapshot.revision, 7)
        XCTAssertEqual(snapshot.entityVersions["meals:abc"], 3)
        XCTAssertEqual(snapshot.state["futureFeature"]["enabled"].boolValue, true)
        let user = FormaUser(id: "synthetic", email: "synthetic@example.test", name: "Synthetic")
        XCTAssertEqual(try JSONDecoder().decode(FormaUser.self, from: JSONEncoder().encode(user)), user)
        XCTAssertEqual(SyncSnapshot(state: snapshot.state, revision: 7, entityVersions: snapshot.entityVersions), snapshot)
    }
}
