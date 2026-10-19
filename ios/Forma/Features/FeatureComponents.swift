import Foundation
import SwiftUI
import FormaCore

enum FeatureTheme {
    static let background = Color(red: 247.0 / 255, green: 248.0 / 255, blue: 250.0 / 255)
    static let ink = Color(red: 23.0 / 255, green: 27.0 / 255, blue: 32.0 / 255)
    static let muted = Color(red: 115.0 / 255, green: 121.0 / 255, blue: 133.0 / 255)
    static let accent = Color(red: 197.0 / 255, green: 244.0 / 255, blue: 103.0 / 255)
    static let border = Color(red: 233.0 / 255, green: 236.0 / 255, blue: 240.0 / 255)
}

enum FeatureFormat {
    static func number(_ value: Double?, language: String, digits: Int = 1) -> String {
        guard let value, value.isFinite else { return "—" }
        if value > 0 && value < 0.001 { return "<0.001" }
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: language == "zh" ? "zh_CN" : "en_US")
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = digits
        formatter.minimumFractionDigits = 0
        let threshold = pow(10, -Double(digits))
        if value > 0 && value < threshold {
            return "<" + (formatter.string(from: NSNumber(value: threshold)) ?? String(threshold))
        }
        return formatter.string(from: NSNumber(value: value)) ?? "—"
    }

    static func input(_ value: String) -> Double? {
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
        guard let result = Double(normalized), result.isFinite else { return nil }
        return result
    }

    static func instant(_ value: String?) -> Date? {
        guard let value else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let result = formatter.date(from: value) { return result }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    static func dateTime(_ value: String?, language: String) -> String {
        guard let date = instant(value) else { return "—" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: language == "zh" ? "zh_CN" : "en_US")
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    static func rows(_ records: [JSONValue]) -> [FeatureRecord] {
        records.enumerated().map { offset, value in
            FeatureRecord(id: value["id"].stringValue ?? "record-\(offset)", value: value)
        }
    }

    static func latest(_ records: [JSONValue]) -> [JSONValue] {
        records.sorted { lhs, rhs in
            let left = (lhs["date"].stringValue ?? "") + (lhs["createdAt"].stringValue ?? "")
            let right = (rhs["date"].stringValue ?? "") + (rhs["createdAt"].stringValue ?? "")
            return left > right
        }
    }
}

struct FeatureRecord: Identifiable {
    let id: String
    let value: JSONValue
}

@MainActor
struct FeatureCard<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) { content }
            .foregroundStyle(FeatureTheme.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(.white, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(FeatureTheme.border, lineWidth: 1).allowsHitTesting(false))
    }
}

@MainActor
struct FeatureMetric: View {
    let title: String
    let value: String
    let unit: String
    let identifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.subheadline).foregroundStyle(FeatureTheme.muted)
            Text(value).font(.system(size: 30, weight: .semibold, design: .rounded))
                .foregroundStyle(FeatureTheme.ink)
                .accessibilityIdentifier(identifier)
            Text(unit).font(.caption).foregroundStyle(FeatureTheme.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

@MainActor
struct FeatureEmpty: View {
    let title: String
    let message: String
    let symbol: String

    var body: some View {
        FeatureCard {
            Image(systemName: symbol).font(.title2).foregroundStyle(FeatureTheme.muted).accessibilityHidden(true)
            Text(title).font(.headline)
            Text(message).font(.subheadline).foregroundStyle(FeatureTheme.muted)
        }
    }
}

@MainActor
struct FeatureAction: View {
    let title: String
    let symbol: String
    let identifier: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 44)
                .padding(.vertical, 5)
        }
        .buttonStyle(.plain)
        .foregroundStyle(FeatureTheme.ink)
        .background(FeatureTheme.accent, in: RoundedRectangle(cornerRadius: 12))
        .accessibilityIdentifier(identifier)
    }
}

@MainActor
struct RecordNotice: View {
    let store: AppStore
    let locked: Bool

    var body: some View {
        if store.isDemo {
            Text(store.text("演示模式：可查看和填写表单，记录不会保存到真实账户。", "Demo mode: explore the form without saving to a real account."))
                .font(.footnote).foregroundStyle(FeatureTheme.muted)
                .accessibilityIdentifier("record.demo.notice")
        }
        if locked {
            Text(store.text("这条记录尚未确认保存。字段已锁定；可重试同一条记录，或取消后刷新核对。", "This save is not confirmed. Fields are locked; retry the same record, or cancel and refresh to check."))
                .font(.footnote).foregroundStyle(FeatureTheme.muted)
                .accessibilityIdentifier("record.retry.notice")
        }
    }
}

@MainActor
struct RecordToolbar: ToolbarContent {
    let store: AppStore
    let canSave: Bool
    let saving: Bool
    let retry: Bool
    let save: () -> Void
    let cancel: () -> Void

    var body: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button(store.text("取消", "Cancel"), action: cancel)
                .disabled(saving).accessibilityIdentifier("record.cancel")
        }
        ToolbarItem(placement: .confirmationAction) {
            Button(action: save) {
                if saving { ProgressView() }
                else { Text(retry ? store.text("重试保存", "Retry save") : store.text("保存", "Save")) }
            }
            .disabled(!canSave || saving)
            .accessibilityIdentifier("record.save")
        }
    }
}

enum FeatureWorkbenchRoute: String, Identifiable {
    case home, library, stats
    var id: String { rawValue }
}

@MainActor
struct FeatureWorkbenchSheet: View {
    @Environment(\.dismiss) private var dismiss
    let store: AppStore
    let route: FeatureWorkbenchRoute

    var body: some View {
        NavigationStack {
            WorkbenchView(store: store, route: route.rawValue)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(store.text("关闭", "Close")) { dismiss() }
                            .accessibilityIdentifier("workbench.close")
                    }
                }
        }
    }
}
