import Foundation
import SwiftUI
import FormaCore

extension Color {
    /// Reads the `#rrggbb` tint the shared companion contract carries for each character.
    init?(companionHex hex: String) {
        var value = hex
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let number = UInt32(value, radix: 16) else { return nil }
        self.init(red: Double((number >> 16) & 0xFF) / 255,
                  green: Double((number >> 8) & 0xFF) / 255,
                  blue: Double(number & 0xFF) / 255)
    }
}

/// The companion artwork stays on the deployed service and is loaded same-origin from the signed-in
/// account's own server. Nothing is bundled, redistributed, or drawn as a stand-in character here.
@MainActor
struct CompanionAvatar: View {
    let store: AppStore
    let character: CompanionCharacter
    let equipped: CompanionItem?
    /// The portrait follows the level: a line's later forms are its reward for getting there.
    var level: Int = 1
    var size: CGFloat = 96
    var thumbnail = false

    private var detail: CompanionCharacterDetail? { companionCharacterDetail(character) }
    private var tint: Color { detail.flatMap { Color(companionHex: $0.color) } ?? FeatureTheme.border }

    /// The portrait that ships with the app. The companion is the one thing that should look
    /// like itself before anything is signed in, so the artwork is read from the bundle rather
    /// than fetched - which also means a demo, a flight and a dead service all show the same.
    private var bundledArtwork: UIImage? {
        guard let form = companionForm(character, level: level) else { return nil }
        let name = "\(form.dex)\(thumbnail ? "-thumb" : "")"
        guard let url = Bundle.main.url(forResource: name, withExtension: "webp",
                                        subdirectory: "CompanionArt")
                ?? Bundle.main.url(forResource: name, withExtension: "webp"),
              let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    /// Only for a deployment whose artwork this build does not carry.
    private var artworkURL: URL? {
        guard !store.isDemo, let base = store.baseURL,
              let path = companionPortraitPath(character, level: level, thumbnail: thumbnail),
              var components = URLComponents(url: base.appendingPathComponent(path),
                                             resolvingAgainstBaseURL: false) else { return nil }
        components.queryItems = [URLQueryItem(name: "v", value: companionArtVersion)]
        return components.url
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size / 5).fill(tint)
            if let bundledArtwork {
                Image(uiImage: bundledArtwork).resizable().scaledToFit().padding(size / 12)
            } else if let artworkURL {
                AsyncImage(url: artworkURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFit().padding(size / 12)
                    case .failure:
                        initials
                    default:
                        // Neutral while loading: no placeholder character, no fake artwork.
                        ProgressView()
                    }
                }
            } else {
                initials
            }
            if let equipped {
                Image(systemName: Self.symbol(for: equipped))
                    .font(.system(size: size / 5))
                    .foregroundStyle(FeatureTheme.ink)
                    .padding(size / 18)
                    .background(.white.opacity(0.85), in: Circle())
                    .frame(width: size, height: size, alignment: .bottomTrailing)
                    .accessibilityHidden(true)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel(name)
        .accessibilityIdentifier("companion.avatar")
    }

    private var initials: some View {
        Text(name)
            .font(.system(size: size / 4, weight: .semibold, design: .rounded))
            .foregroundStyle(FeatureTheme.ink)
            .minimumScaleFactor(0.5)
            .padding(size / 10)
            .multilineTextAlignment(.center)
    }

    private var name: String {
        guard let detail else { return character.rawValue }
        return store.language == "zh" ? detail.zh : detail.en
    }

    /// A wardrobe accessory is shown as a plain system symbol, not as reproduced third-party art.
    static func symbol(for item: CompanionItem) -> String {
        switch item {
        case .leaf: return "leaf.fill"
        case .cap: return "graduationcap.fill"
        case .star: return "star.fill"
        case .scarf: return "wind"
        case .flower: return "camera.macro"
        case .crown: return "crown.fill"
        }
    }

    static func itemName(_ item: CompanionItem, store: AppStore) -> String {
        switch item {
        case .leaf: return store.text("叶子", "Leaf")
        case .cap: return store.text("小帽", "Cap")
        case .star: return store.text("星星", "Star")
        case .scarf: return store.text("围巾", "Scarf")
        case .flower: return store.text("小花", "Flower")
        case .crown: return store.text("王冠", "Crown")
        }
    }

    static func questName(_ quest: CompanionQuest, store: AppStore) -> String {
        switch quest {
        case .nutrition: return store.text("记录一次饮食", "Record a meal")
        case .movement: return store.text("记录一次训练", "Record a workout")
        case .sleep: return store.text("记录一次睡眠", "Record your sleep")
        }
    }
}

/// Mirrors the website's companion card on the dashboard: a short summary that opens the full page.
@MainActor
struct CompanionCard: View {
    let store: AppStore

    var body: some View {
        FeatureCard {
            if let companion = store.companion {
                NavigationLink {
                    CompanionView(store: store)
                } label: {
                    HStack(spacing: 14) {
                        CompanionAvatar(store: store, character: companion.character,
                                        equipped: companion.equipped, level: companion.level,
                                        size: 64, thumbnail: true)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(companionName(companion.character))
                                .font(.headline).foregroundStyle(FeatureTheme.ink)
                            Text(store.text("等级 \(companion.level) · 已陪伴 \(companion.activeDays) 天",
                                            "Level \(companion.level) · \(companion.activeDays) days together"))
                                .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                                .accessibilityIdentifier("companion.card.summary")
                            Text(store.text("\(completedCount(companion)) / \(companion.quests.count) 今日任务",
                                            "\(completedCount(companion)) of \(companion.quests.count) tasks today"))
                                .font(.caption).foregroundStyle(FeatureTheme.muted)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.footnote).foregroundStyle(FeatureTheme.muted)
                            .accessibilityHidden(true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("companion.card")
                Text(store.text("XP 是养成进度，不是健康评分。", "XP is game progress, not a health score."))
                    .font(.caption2).foregroundStyle(FeatureTheme.muted)
            } else {
                Text(store.text("伙伴", "Companion")).font(.headline)
                Text(store.text("正在读取伙伴进度。", "Loading your companion."))
                    .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                    .accessibilityIdentifier("companion.card.loading")
            }
        }
        .task { await store.loadCompanion() }
    }

    private func completedCount(_ companion: CompanionSnapshot) -> Int {
        companion.quests.filter(\.completed).count
    }

    private func companionName(_ character: CompanionCharacter) -> String {
        guard let detail = companionCharacterDetail(character) else { return character.rawValue }
        return store.language == "zh" ? detail.zh : detail.en
    }
}
