import Foundation

/// Mirrors the shared game contract in `src/companion.ts`.
/// XP is game progress, never a health score, and never derived from health facts here.
public let companionRuleVersion = 1

public enum CompanionCharacter: String, Codable, CaseIterable, Sendable {
    case sprout, bunny, otter, cloud, bear, seal
}

public enum CompanionItem: String, Codable, CaseIterable, Sendable {
    case leaf, cap, star, scarf, flower, crown
}

public enum CompanionQuest: String, Codable, CaseIterable, Sendable {
    case nutrition, movement, sleep
}

public struct CompanionCharacterDetail: Equatable, Sendable {
    public let zh: String
    public let en: String
    public let descriptionZh: String
    public let descriptionEn: String
    /// The character's own background tint from the shared contract, used for neutral placeholders.
    public let color: String

    public init(zh: String, en: String, descriptionZh: String, descriptionEn: String, color: String) {
        self.zh = zh
        self.en = en
        self.descriptionZh = descriptionZh
        self.descriptionEn = descriptionEn
        self.color = color
    }
}

/// Copied verbatim from `COMPANION_CHARACTER_DETAILS`; the artwork itself stays on the deployed service.
public let companionCharacterDetails: [CompanionCharacter: CompanionCharacterDetail] = [
    .sprout: .init(zh: "芽芽", en: "Sprout", descriptionZh: "一点一点，长成喜欢的样子。", descriptionEn: "A little growth, at your own pace.", color: "#edf5dd"),
    .bunny: .init(zh: "糯糯", en: "Mochi", descriptionZh: "小步跳，也能走很远。", descriptionEn: "Little hops can take you far.", color: "#f8eee8"),
    .otter: .init(zh: "桃桃", en: "Peach", descriptionZh: "把平常的一天，过得有点可爱。", descriptionEn: "A little joy in an ordinary day.", color: "#f9eae3"),
    .cloud: .init(zh: "云云", en: "Nimbus", descriptionZh: "慢下来，也是一种前进。", descriptionEn: "Taking it slow is progress, too.", color: "#eaf2f9"),
    .bear: .init(zh: "蜜蜜", en: "Honey", descriptionZh: "稳稳地，陪你继续。", descriptionEn: "Steady company for the next step.", color: "#f8f0dc"),
    .seal: .init(zh: "月月", en: "Luna", descriptionZh: "今天也给自己一点温柔。", descriptionEn: "A little kindness for yourself today.", color: "#f0edf8"),
]

public struct CompanionChest: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let milestone: Int
    public let item: CompanionItem?
    public let openedAt: String?

    public var isOpened: Bool { openedAt != nil }

    public init(id: String, milestone: Int, item: CompanionItem?, openedAt: String?) {
        self.id = id
        self.milestone = milestone
        self.item = item
        self.openedAt = openedAt
    }
}

public struct CompanionChallengeParticipant: Codable, Equatable, Sendable {
    /// `self` in the wire contract: whether this row is the signed-in account.
    public let isSelf: Bool
    /// Days this participant has earned a reward in; a game count, not a health metric.
    public let days: Int

    public init(isSelf: Bool, days: Int) {
        self.isSelf = isSelf
        self.days = days
    }

    private enum CodingKeys: String, CodingKey {
        case isSelf = "self"
        case days
    }
}

public struct CompanionChallenge: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let code: String
    public let startsAt: String
    public let endsAt: String
    public let participants: [CompanionChallengeParticipant]

    public init(id: String, code: String, startsAt: String, endsAt: String, participants: [CompanionChallengeParticipant]) {
        self.id = id
        self.code = code
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.participants = participants
    }
}

public struct CompanionQuestState: Codable, Equatable, Sendable, Identifiable {
    public let id: CompanionQuest
    public let completed: Bool
    public let xp: Int

    public init(id: CompanionQuest, completed: Bool, xp: Int) {
        self.id = id
        self.completed = completed
        self.xp = xp
    }
}

public struct CompanionSnapshot: Codable, Equatable, Sendable {
    public let ruleVersion: Int
    public let character: CompanionCharacter
    /// The server's UTC reward day. Fixed across time-zone changes.
    public let day: String
    public let xp: Int
    public let level: Int
    public let activeDays: Int
    public let equipped: CompanionItem?
    public let inventory: [CompanionItem]
    public let quests: [CompanionQuestState]
    public let chests: [CompanionChest]
    public let challenge: CompanionChallenge?

    public init(ruleVersion: Int, character: CompanionCharacter, day: String, xp: Int, level: Int,
                activeDays: Int, equipped: CompanionItem?, inventory: [CompanionItem],
                quests: [CompanionQuestState], chests: [CompanionChest], challenge: CompanionChallenge?) {
        self.ruleVersion = ruleVersion
        self.character = character
        self.day = day
        self.xp = xp
        self.level = level
        self.activeDays = activeDays
        self.equipped = equipped
        self.inventory = inventory
        self.quests = quests
        self.chests = chests
        self.challenge = challenge
    }

    private enum CodingKeys: String, CodingKey {
        case ruleVersion, character, day, xp, level, activeDays, equipped, inventory, quests, chests, challenge
    }

    private struct RawQuest: Decodable {
        let id: String
        let completed: Bool?
        let xp: Int?
    }

    private struct RawChest: Decodable {
        let id: String
        let milestone: Int?
        let item: String?
        let openedAt: String?
    }

    /// Tolerates a service that is older or newer than this build: an unknown character, item or
    /// quest is dropped instead of discarding the whole snapshot. A record that is simply absent
    /// stays absent — it is never shown as zero.
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        ruleVersion = (try? container.decode(Int.self, forKey: .ruleVersion)) ?? companionRuleVersion
        // Archives written before the six characters shipped carry no character at all.
        character = (try? container.decode(CompanionCharacter.self, forKey: .character)) ?? .sprout
        day = (try? container.decode(String.self, forKey: .day)) ?? ""
        let decodedXP = (try? container.decode(Int.self, forKey: .xp)) ?? 0
        xp = decodedXP
        activeDays = (try? container.decode(Int.self, forKey: .activeDays)) ?? 0
        level = (try? container.decode(Int.self, forKey: .level)) ?? companionLevel(xp: decodedXP)
        equipped = try? container.decode(CompanionItem.self, forKey: .equipped)
        inventory = ((try? container.decode([String].self, forKey: .inventory)) ?? [])
            .compactMap(CompanionItem.init(rawValue:))
        quests = ((try? container.decode([RawQuest].self, forKey: .quests)) ?? [])
            .compactMap { raw in
                guard let id = CompanionQuest(rawValue: raw.id) else { return nil }
                return CompanionQuestState(id: id, completed: raw.completed ?? false, xp: raw.xp ?? 0)
            }
        chests = ((try? container.decode([RawChest].self, forKey: .chests)) ?? [])
            .map { raw in
                CompanionChest(id: raw.id, milestone: raw.milestone ?? 0,
                               item: raw.item.flatMap(CompanionItem.init(rawValue:)), openedAt: raw.openedAt)
            }
        challenge = try? container.decode(CompanionChallenge.self, forKey: .challenge)
    }

    public func quest(_ id: CompanionQuest) -> CompanionQuestState? {
        quests.first { $0.id == id }
    }

    /// Progress inside the current level, 0...1. Presentation only; never a health score.
    public var levelProgress: Double {
        let within = Double(xp % 100)
        return min(max(within / 100, 0), 1)
    }
}

/// Mirrors `companionLevel` in the shared contract: `1 + Math.floor(xp / 100)`.
public func companionLevel(xp: Int) -> Int {
    1 + Int(floor(Double(xp) / 100))
}

/// The UTC reward day, matching `new Date().toISOString().slice(0, 10)` on the service.
public func companionDay(_ date: Date = Date()) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
}

/// The demo companion from the shared contract. Demo progress is never saved to a real account.
public func demoCompanion(now: Date = Date()) -> CompanionSnapshot {
    CompanionSnapshot(
        ruleVersion: companionRuleVersion, character: .sprout, day: companionDay(now),
        xp: 140, level: 2, activeDays: 6, equipped: .leaf, inventory: [.leaf],
        quests: [
            CompanionQuestState(id: .nutrition, completed: true, xp: 10),
            CompanionQuestState(id: .movement, completed: false, xp: 10),
            CompanionQuestState(id: .sleep, completed: true, xp: 10),
        ],
        chests: [
            CompanionChest(id: "demo-3", milestone: 3, item: .leaf, openedAt: "2026-10-18T00:00:00Z"),
            CompanionChest(id: "demo-6", milestone: 6, item: nil, openedAt: nil),
        ],
        challenge: nil
    )
}

/// Mirrors the service's milestone reward: `COMPANION_ITEMS[(milestone / 3 - 1) % COMPANION_ITEMS.length]`.
/// Returns nil for a milestone the contract does not reward, so an unknown chest stays unknown.
public func companionChestItem(milestone: Int) -> CompanionItem? {
    guard milestone >= 3, milestone % 3 == 0 else { return nil }
    let items = CompanionItem.allCases
    return items[(milestone / 3 - 1) % items.count]
}

public extension CompanionSnapshot {
    /// Local-only presentation copies. The service remains the source of truth for a real account;
    /// these exist for the clearly labelled demo, which is never saved.
    func replacingCharacter(_ character: CompanionCharacter) -> CompanionSnapshot {
        CompanionSnapshot(ruleVersion: ruleVersion, character: character, day: day, xp: xp, level: level,
                          activeDays: activeDays, equipped: equipped, inventory: inventory,
                          quests: quests, chests: chests, challenge: challenge)
    }

    /// Refuses an item this snapshot does not own, exactly as the service's `ITEM_NOT_OWNED` does.
    func replacingEquipped(_ item: CompanionItem?) -> CompanionSnapshot? {
        if let item, !inventory.contains(item) { return nil }
        return CompanionSnapshot(ruleVersion: ruleVersion, character: character, day: day, xp: xp, level: level,
                                 activeDays: activeDays, equipped: item, inventory: inventory,
                                 quests: quests, chests: chests, challenge: challenge)
    }

    /// Opens a closed chest and adds its milestone reward to the inventory. An already open chest
    /// and an unknown id both leave the snapshot untouched.
    func openingChest(id: String, at instant: Date = Date()) -> CompanionSnapshot? {
        guard let index = chests.firstIndex(where: { $0.id == id }), !chests[index].isOpened else { return nil }
        let chest = chests[index]
        let item = chest.item ?? companionChestItem(milestone: chest.milestone)
        var updated = chests
        updated[index] = CompanionChest(id: chest.id, milestone: chest.milestone, item: item,
                                        openedAt: companionInstant(instant))
        let owned = CompanionItem.allCases.filter { candidate in updated.contains { $0.item == candidate } }
        return CompanionSnapshot(ruleVersion: ruleVersion, character: character, day: day, xp: xp, level: level,
                                 activeDays: activeDays, equipped: equipped, inventory: owned,
                                 quests: quests, chests: updated, challenge: challenge)
    }
}

/// The wire instant format the service uses, formatted here so callers outside this package
/// never need the package's internal date helpers.
public func companionInstant(_ date: Date = Date()) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    return formatter.string(from: date)
}
