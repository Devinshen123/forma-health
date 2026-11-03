import Foundation

/// Mirrors `src/companion-growth.ts`: which form a character wears at a level, and where
/// the deployed service keeps its portrait. The thresholds are Forma's own progression,
/// not the original games' item or friendship requirements, and the six long-standing ids
/// keep their accounts, XP and wardrobes by staying the family id of their own line.
public struct CompanionForm: Equatable, Sendable {
    public let dex: Int
    public let level: Int
    public let zh: String
    public let en: String

    public init(dex: Int, level: Int, zh: String, en: String) {
        self.dex = dex
        self.level = level
        self.zh = zh
        self.en = en
    }
}

/// Copied from `COMPANION_ART_VERSION`; the service changes it when the artwork changes.
public let companionArtVersion = "pokedex151-20261023"

let legacyCompanionEvolutions: [CompanionCharacter: [CompanionForm]] = [
    .sprout: [.init(dex: 1, level: 1, zh: "妙蛙种子", en: "Bulbasaur"),
              .init(dex: 2, level: 3, zh: "妙蛙草", en: "Ivysaur"),
              .init(dex: 3, level: 5, zh: "妙蛙花", en: "Venusaur")],
    .bunny: [.init(dex: 25, level: 1, zh: "皮卡丘", en: "Pikachu"),
             .init(dex: 26, level: 3, zh: "雷丘", en: "Raichu")],
    .otter: [.init(dex: 7, level: 1, zh: "杰尼龟", en: "Squirtle"),
             .init(dex: 8, level: 3, zh: "卡咪龟", en: "Wartortle"),
             .init(dex: 9, level: 5, zh: "水箭龟", en: "Blastoise")],
    .cloud: [.init(dex: 39, level: 1, zh: "胖丁", en: "Jigglypuff"),
             .init(dex: 40, level: 3, zh: "胖可丁", en: "Wigglytuff")],
    .bear: [.init(dex: 446, level: 1, zh: "小卡比兽", en: "Munchlax"),
            .init(dex: 143, level: 3, zh: "卡比兽", en: "Snorlax")],
    .seal: [.init(dex: 133, level: 1, zh: "伊布", en: "Eevee"),
            .init(dex: 136, level: 3, zh: "火伊布", en: "Flareon")],
]

/// The rest of the line a catalog character still has ahead of it, two levels apart.
func pokemonEvolutionForms(dex: Int) -> [CompanionForm] {
    let chain = pokemonEvolutionChains.first { $0.contains(dex) }
    let path: [Int]
    if let chain, let start = chain.firstIndex(of: dex) {
        path = Array(chain[start...])
    } else {
        path = [dex]
    }
    return path.enumerated().compactMap { index, id in
        guard let entry = pokemonEntry(dex: id) else { return nil }
        return CompanionForm(dex: id, level: 1 + index * 2, zh: entry.zh, en: entry.en)
    }
}

public func companionEvolutionForms(_ character: CompanionCharacter) -> [CompanionForm] {
    if let forms = legacyCompanionEvolutions[character] { return forms }
    guard let dex = character.pokemonDex else { return [] }
    return pokemonEvolutionForms(dex: dex)
}

public func companionGrowthStage(level: Int, character: CompanionCharacter = .sprout) -> Int {
    let reached = max(1, level)
    return companionEvolutionForms(character).enumerated()
        .reduce(0) { stage, form in form.element.level <= reached ? form.offset : stage }
}

/// The form shown at this level, or nil for a character with no artwork to show.
public func companionForm(_ character: CompanionCharacter, level: Int) -> CompanionForm? {
    let forms = companionEvolutionForms(character)
    guard !forms.isEmpty else { return nil }
    return forms[min(companionGrowthStage(level: level, character: character), forms.count - 1)]
}

/// The service path for a portrait, relative to the site root.
public func companionPortraitPath(_ character: CompanionCharacter, level: Int, thumbnail: Bool = false) -> String? {
    guard let form = companionForm(character, level: level) else { return nil }
    return "companions/forms/\(form.dex)\(thumbnail ? "-thumb" : "").webp"
}

/// The next form and the XP still owed for it, or nil for a line already at its end.
public func nextCompanionEvolution(_ character: CompanionCharacter, xp: Int) -> (form: CompanionForm, remainingXP: Int)? {
    let earned = max(0, xp)
    let level = 1 + earned / 100
    let forms = companionEvolutionForms(character)
    let next = companionGrowthStage(level: level, character: character) + 1
    guard next < forms.count else { return nil }
    return (forms[next], max(0, (forms[next].level - 1) * 100 - earned))
}

/// Mirrors `searchPokemon`: name in either language, or the dex number with or
/// without its leading zeroes and `#`. An empty query and type match everything.
public func searchPokemon(_ query: String, type: String = "") -> [PokemonEntry] {
    var normalized = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if normalized.hasPrefix("#") { normalized = String(normalized.dropFirst()) }
    return pokemonCatalog.filter { entry in
        guard type.isEmpty || entry.types.contains(type) else { return false }
        guard !normalized.isEmpty else { return true }
        return entry.zh.contains(normalized) || entry.en.lowercased().contains(normalized)
            || String(format: "%03d", entry.dex).contains(normalized)
    }
}

/// How many pages of `pageSize` the catalog gallery shows for a result set.
public let pokemonGalleryPageSize = 24
