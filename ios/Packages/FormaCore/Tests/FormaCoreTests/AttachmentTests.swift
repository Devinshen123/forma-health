import XCTest
@testable import FormaCore

final class AttachmentTests: XCTestCase {
    private func png() -> Data {
        var bytes: [UInt8] = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]
        bytes += Array("IHDR".utf8)
        bytes += [UInt8](repeating: 0, count: 12)
        return Data(bytes)
    }

    private func pdf(version: String = "1.4") -> Data {
        Data("%PDF-\(version)\n…body…\n%%EOF".utf8)
    }

    func testEachAcceptedTypeIsReadFromItsOwnBytes() {
        XCTAssertEqual(Attachment.type(of: png()), "image/png")
        XCTAssertEqual(Attachment.type(of: Data([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "image/jpeg")
        XCTAssertEqual(Attachment.type(of: Data("GIF89a".utf8) + Data(repeating: 0, count: 8)), "image/gif")
        XCTAssertEqual(Attachment.type(of: Data("RIFF\u{0}\u{0}\u{0}\u{0}WEBPVP8 ".utf8)), "image/webp")
        XCTAssertEqual(Attachment.type(of: pdf()), "application/pdf")
        XCTAssertEqual(Attachment.type(of: pdf(version: "2.0")), "application/pdf")
    }

    func testBytesThatOnlyLookLikeAFileAreRefused() {
        XCTAssertNil(Attachment.type(of: Data("not a picture at all".utf8)))
        // A truncated PNG header is not a PNG: the service checks IHDR too.
        XCTAssertNil(Attachment.type(of: Data([137, 80, 78, 71, 13, 10, 26, 10])))
        // A PDF with no end marker is refused by the service, so it is refused here.
        XCTAssertNil(Attachment.type(of: Data("%PDF-1.4\nbody with no trailer".utf8)))
        XCTAssertNil(Attachment.type(of: Data("%PDF-3.0\n…\n%%EOF".utf8)))
    }

    func testTheRefusalSaysWhichRuleTheBytesBreak() {
        XCTAssertEqual(Attachment.refusal(for: Data()), .empty)
        XCTAssertEqual(Attachment.refusal(for: Data("hello".utf8)), .unsupported)
        XCTAssertEqual(Attachment.refusal(for: Data(repeating: 0xff, count: Attachment.maximumBytes + 1)), .tooLarge)
        XCTAssertNil(Attachment.refusal(for: png()))
        XCTAssertNil(Attachment.refusal(for: png(), photoOnly: true))
        // A PDF is a fine original for a report and not a meal photo.
        XCTAssertNil(Attachment.refusal(for: pdf()))
        XCTAssertEqual(Attachment.refusal(for: pdf(), photoOnly: true), .notAPhoto)
        XCTAssertEqual(Attachment.refusal(for: Data("GIF89a".utf8) + Data(repeating: 0, count: 8), photoOnly: true),
                       .notAPhoto)
    }

    func testTheSizeLimitIsTheServicesOwn() {
        XCTAssertEqual(Attachment.maximumBytes, 10 * 1024 * 1024)
        let exactly = png() + Data(repeating: 0, count: Attachment.maximumBytes - png().count)
        XCTAssertEqual(exactly.count, Attachment.maximumBytes)
        XCTAssertNil(Attachment.refusal(for: exactly), "The limit itself is still accepted")
        XCTAssertEqual(Attachment.refusal(for: exactly + Data([0])), .tooLarge)
    }
}
