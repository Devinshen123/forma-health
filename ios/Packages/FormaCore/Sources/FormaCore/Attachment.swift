import Foundation

/// What the service accepts as an original, decided the way the service decides it:
/// from the bytes themselves. A file name or a picker's claim is never trusted for this,
/// so an upload is refused here rather than rejected after a 10 MB round trip.
public enum Attachment {
    public static let maximumBytes = 10 * 1024 * 1024

    /// The types `POST /api/assets` accepts, in the order the service lists them.
    public static let acceptedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]

    /// Only these can be read as a meal photo; the service refuses the rest for that.
    public static let photoTypes = ["image/jpeg", "image/png", "image/webp"]

    /// Mirrors `matchesMagic` in `server/app.ts`.
    public static func type(of data: Data) -> String? {
        let bytes = [UInt8](data.prefix(16))
        if bytes.count >= 16, data.count >= 24,
           Array(bytes[0..<8]) == [137, 80, 78, 71, 13, 10, 26, 10], ascii(data, 12, 16) == "IHDR" {
            return "image/png"
        }
        if bytes.count >= 4, bytes[0] == 0xff, bytes[1] == 0xd8, bytes[2] == 0xff { return "image/jpeg" }
        if data.count >= 13, let head = ascii(data, 0, 6), ["GIF87a", "GIF89a"].contains(head) { return "image/gif" }
        if data.count >= 16, ascii(data, 0, 4) == "RIFF", ascii(data, 8, 12) == "WEBP" { return "image/webp" }
        if data.count >= 12, let head = ascii(data, 0, 8), isPDFHeader(head),
           data.suffix(1024).range(of: Data("%%EOF".utf8)) != nil {
            return "application/pdf"
        }
        return nil
    }

    /// The refusal for bytes this build will not send, or nil when the service can take them.
    public static func refusal(for data: Data, photoOnly: Bool = false) -> AttachmentRefusal? {
        guard !data.isEmpty else { return .empty }
        guard data.count <= maximumBytes else { return .tooLarge }
        guard let type = type(of: data) else { return .unsupported }
        if photoOnly && !photoTypes.contains(type) { return .notAPhoto }
        return nil
    }

    private static func ascii(_ data: Data, _ start: Int, _ end: Int) -> String? {
        guard data.count >= end else { return nil }
        let slice = data.subdata(in: (data.startIndex + start)..<(data.startIndex + end))
        return String(data: slice, encoding: .ascii)
    }

    private static func isPDFHeader(_ head: String) -> Bool {
        guard head.hasPrefix("%PDF-") else { return false }
        let version = head.dropFirst(5)
        if version.hasPrefix("2.0") { return true }
        guard version.hasPrefix("1."), let digit = version.dropFirst(2).first else { return false }
        return digit.isNumber
    }
}

public enum AttachmentRefusal: Equatable, Sendable {
    case empty, tooLarge, unsupported, notAPhoto
}
