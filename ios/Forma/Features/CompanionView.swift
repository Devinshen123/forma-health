import Foundation
import SwiftUI
import FormaCore

/// The companion growth page. XP, levels and streak days are game progress derived by the service
/// from whether a record exists — never a health score, and never a judgement about the records.
@MainActor
struct CompanionView: View {
    let store: AppStore
    @State private var inviteCode = ""
    @State private var catalogQuery = ""
    @State private var catalogType = ""
    @State private var catalogPage = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let companion = store.companion {
                    header(companion)
                    island(companion)
                    quests(companion)
                    chests(companion)
                    wardrobe(companion)
                    characters(companion)
                    challenge(companion)
                } else {
                    FeatureEmpty(title: store.text("正在读取伙伴", "Loading your companion"),
                                 message: store.text("稍等一下，或下拉刷新。", "One moment, or pull to refresh."),
                                 symbol: "hourglass")
                }
            }
            .padding(20)
        }
        .background(FeatureTheme.background)
        .navigationTitle(store.text("伙伴", "Companion"))
        .refreshable { await store.loadCompanion() }
        .task { await store.loadCompanion() }
        .accessibilityIdentifier("screen.companion")
    }

    // MARK: - Sections

    /// The island is the website's 3D scene, opened in the app's own web view rather
    /// than redrawn natively. The invitation says so, so nobody expects a native world.
    private func island(_ companion: CompanionSnapshot) -> some View {
        FeatureCard {
            NavigationLink {
                CompanionIslandView(store: store, character: companion.character, level: companion.level)
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "tree").font(.title2).foregroundStyle(FeatureTheme.ink)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(store.text("给伙伴一个，一起生活的小世界。",
                                        "A little world to live in, together."))
                            .font(.headline).foregroundStyle(FeatureTheme.ink)
                        Text(store.text("吃果子、点篝火、浇花，也会和邻居互相回应。",
                                        "Fruit, campfires, flowers and little reactions between friends."))
                            .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.footnote)
                        .foregroundStyle(FeatureTheme.muted).accessibilityHidden(true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("companion.island.open")
            Text(store.text("乐园是网站上的 3D 场景，在应用内打开。",
                            "The island is the website's 3D scene, opened inside the app."))
                .font(.caption2).foregroundStyle(FeatureTheme.muted)
        }
    }

    private func header(_ companion: CompanionSnapshot) -> some View {
        FeatureCard {
            // A pushed page does not inherit the tab's demo banner, so it says so itself.
            RecordNotice(store: store, locked: false)
            if let error = store.companionError {
                Text(error).font(.footnote).foregroundStyle(.red)
                    .accessibilityIdentifier("companion.error")
            }
            HStack(alignment: .top, spacing: 16) {
                CompanionAvatar(store: store, character: companion.character, equipped: companion.equipped,
                                level: companion.level, size: 104)
                VStack(alignment: .leading, spacing: 6) {
                    Text(name(companion.character)).font(.title3.weight(.semibold))
                    Text(description(companion.character))
                        .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                    Text(store.text("等级 \(companion.level)", "Level \(companion.level)"))
                        .font(.headline).accessibilityIdentifier("companion.level")
                }
                Spacer(minLength: 0)
            }
            ProgressView(value: companion.levelProgress)
                .tint(FeatureTheme.accent)
                .accessibilityIdentifier("companion.progress")
            Text(store.text("\(companion.xp) XP · 距下一级还差 \(100 - companion.xp % 100) XP",
                            "\(companion.xp) XP · \(100 - companion.xp % 100) XP to the next level"))
                .font(.caption).foregroundStyle(FeatureTheme.muted)
                .accessibilityIdentifier("companion.xp")
            Text(store.text("已陪伴 \(companion.activeDays) 天", "\(companion.activeDays) days together"))
                .font(.subheadline).accessibilityIdentifier("companion.activeDays")
            Text(store.text("XP 是养成进度，不是健康评分；没有记录不代表没有做。",
                            "XP is game progress, not a health score; an unrecorded day is not a missed day."))
                .font(.caption2).foregroundStyle(FeatureTheme.muted)
        }
    }

    private func quests(_ companion: CompanionSnapshot) -> some View {
        FeatureCard {
            Text(store.text("今日任务", "Today’s tasks")).font(.headline)
            Text(store.text("按服务端的 UTC 奖励日 \(companion.day) 计算。",
                            "Counted on the service’s UTC reward day \(companion.day)."))
                .font(.caption).foregroundStyle(FeatureTheme.muted)
            ForEach(companion.quests) { quest in
                HStack(spacing: 10) {
                    Image(systemName: quest.completed ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(quest.completed ? FeatureTheme.ink : FeatureTheme.muted)
                        .accessibilityHidden(true)
                    Text(CompanionAvatar.questName(quest.id, store: store))
                        .foregroundStyle(FeatureTheme.ink)
                    Spacer(minLength: 0)
                    Text("+\(quest.xp) XP").font(.caption).foregroundStyle(FeatureTheme.muted)
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("companion.quest.\(quest.id.rawValue)")
            }
            if companion.quests.isEmpty {
                Text(store.text("今天还没有任务。", "No tasks today."))
                    .font(.subheadline).foregroundStyle(FeatureTheme.muted)
            }
            FeatureAction(title: store.text("领取今日奖励", "Claim today’s reward"),
                          symbol: "sparkles", identifier: "companion.claim") {
                Task { await store.claimCompanion() }
            }
            .disabled(store.companionBusy)
            Button(store.text("今天休息一下", "Take a rest day")) {
                Task { await store.claimCompanion(rest: true) }
            }
            .font(.subheadline)
            .disabled(store.companionBusy)
            .accessibilityIdentifier("companion.rest")
            Text(store.text("奖励只看“有没有记录”，不评价记录内容。休息日不会中断陪伴天数。",
                            "Rewards only look at whether a record exists, never at what it says. A rest day keeps your streak."))
                .font(.caption2).foregroundStyle(FeatureTheme.muted)
        }
    }

    private func chests(_ companion: CompanionSnapshot) -> some View {
        FeatureCard {
            Text(store.text("里程碑宝箱", "Milestone chests")).font(.headline)
            if companion.chests.isEmpty {
                Text(store.text("继续记录，就会出现第一个宝箱。", "Keep recording and your first chest will appear."))
                    .font(.subheadline).foregroundStyle(FeatureTheme.muted)
            }
            ForEach(companion.chests) { chest in
                HStack(spacing: 10) {
                    Image(systemName: chest.isOpened ? "shippingbox.fill" : "shippingbox")
                        .foregroundStyle(FeatureTheme.ink).accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(store.text("第 \(chest.milestone) 天", "Day \(chest.milestone)"))
                            .foregroundStyle(FeatureTheme.ink)
                        if chest.isOpened {
                            if let item = chest.item {
                                Text(CompanionAvatar.itemName(item, store: store))
                                    .font(.caption).foregroundStyle(FeatureTheme.muted)
                            } else {
                                // The service sent an item this build does not know; never guess one.
                                Text(store.text("已开启 · 这件装扮本版本未收录",
                                                "Opened · this build does not know this item"))
                                    .font(.caption).foregroundStyle(FeatureTheme.muted)
                            }
                        }
                    }
                    Spacer(minLength: 0)
                    if chest.isOpened {
                        Text(store.text("已开启", "Opened")).font(.caption).foregroundStyle(FeatureTheme.muted)
                            .accessibilityIdentifier("companion.chest.\(chest.id).opened")
                    } else {
                        Button(store.text("打开", "Open")) {
                            Task { await store.openCompanionChest(id: chest.id) }
                        }
                        .font(.subheadline)
                        .disabled(store.companionBusy)
                        .accessibilityIdentifier("companion.chest.\(chest.id).open")
                    }
                }
            }
        }
    }

    private func wardrobe(_ companion: CompanionSnapshot) -> some View {
        FeatureCard {
            Text(store.text("衣柜", "Wardrobe")).font(.headline)
            if companion.inventory.isEmpty {
                Text(store.text("打开里程碑宝箱才会获得装扮。", "Open a milestone chest to collect an accessory."))
                    .font(.subheadline).foregroundStyle(FeatureTheme.muted)
            } else {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                    ForEach(companion.inventory, id: \.rawValue) { item in
                        Button {
                            Task { await store.equipCompanion(companion.equipped == item ? nil : item) }
                        } label: {
                            VStack(spacing: 6) {
                                Image(systemName: CompanionAvatar.symbol(for: item)).font(.title3)
                                Text(CompanionAvatar.itemName(item, store: store)).font(.caption)
                            }
                            .frame(maxWidth: .infinity, minHeight: 64)
                            .background(companion.equipped == item ? FeatureTheme.accent : Color.white,
                                        in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(FeatureTheme.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(FeatureTheme.ink)
                        .disabled(store.companionBusy)
                        .accessibilityIdentifier("companion.item.\(item.rawValue)")
                        .accessibilityAddTraits(companion.equipped == item ? [.isSelected] : [])
                    }
                }
                Text(store.text("再点一次可以取下。", "Tap again to take it off."))
                    .font(.caption2).foregroundStyle(FeatureTheme.muted)
            }
        }
    }

    /// Mirrors the website's gallery: search, a type filter and 24 at a time, with the
    /// six long-standing companions kept behind a disclosure rather than dropped.
    private func characters(_ companion: CompanionSnapshot) -> some View {
        let results = searchPokemon(catalogQuery, type: catalogType)
        let pages = max(1, Int(ceil(Double(results.count) / Double(pokemonGalleryPageSize))))
        let page = min(catalogPage, pages - 1)
        let shown = Array(results.dropFirst(page * pokemonGalleryPageSize).prefix(pokemonGalleryPageSize))
        return FeatureCard {
            Text(store.text("151 位伙伴，等你认识。", "151 companions to meet."))
                .font(.headline)
            Text(store.text("每个角色都免费；切换不会重置 XP、装扮或奖励。",
                            "Every character is free; switching never resets XP, your wardrobe or rewards."))
                .font(.caption).foregroundStyle(FeatureTheme.muted)
            Text(store.text("原有六位伙伴（保留小卡比兽）",
                            "Your original six companions (including Munchlax)"))
                .font(.subheadline.weight(.medium)).foregroundStyle(FeatureTheme.ink)
                .accessibilityIdentifier("companion.classic")
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 12) {
                ForEach(CompanionCharacter.legacy, id: \.rawValue) { character in
                    cell(character, current: companion.character, caption: nil)
                }
            }
            TextField(store.text("中文、英文或编号，如 小火龙 / 004", "Name or number, e.g. Charmander / 004"),
                      text: $catalogQuery)
                .textFieldStyle(.roundedBorder)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .accessibilityIdentifier("companion.catalog.search")
                .onChange(of: catalogQuery) { catalogPage = 0 }
            Picker(store.text("属性", "Type"), selection: $catalogType) {
                Text(store.text("全部属性", "All types")).tag("")
                ForEach(pokemonTypeNames, id: \.id) { type in
                    Text(store.language == "zh" ? type.zh : type.en).tag(type.id)
                }
            }
            .pickerStyle(.menu)
            .accessibilityIdentifier("companion.catalog.type")
            .onChange(of: catalogType) { catalogPage = 0 }
            Text(store.text("找到 \(results.count) / \(pokemonCatalog.count) 位伙伴",
                            "\(results.count) of \(pokemonCatalog.count) companions"))
                .font(.caption).foregroundStyle(FeatureTheme.muted)
                .accessibilityIdentifier("companion.catalog.count")
            if shown.isEmpty {
                Text(store.text("没有找到这位伙伴，试试名字或图鉴编号。",
                                "No companions found. Try a name or Pokédex number."))
                    .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                    .accessibilityIdentifier("companion.catalog.empty")
            } else {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 12) {
                    ForEach(shown, id: \.dex) { entry in
                        cell(.pokemon(dex: entry.dex), current: companion.character,
                             caption: String(format: "#%03d", entry.dex))
                    }
                }
                if pages > 1 {
                    HStack {
                        Button(store.text("上一页", "Previous")) { catalogPage = max(0, page - 1) }
                            .disabled(page == 0).accessibilityIdentifier("companion.catalog.previous")
                        Spacer(minLength: 0)
                        Text("\(page + 1) / \(pages)").font(.caption).foregroundStyle(FeatureTheme.muted)
                            .accessibilityIdentifier("companion.catalog.page")
                        Spacer(minLength: 0)
                        Button(store.text("下一页", "Next")) { catalogPage = min(pages - 1, page + 1) }
                            .disabled(page >= pages - 1).accessibilityIdentifier("companion.catalog.next")
                    }
                    .font(.subheadline)
                }
            }
            // The six that predate the catalog stay in plain sight. Behind a disclosure they
            // are a hidden state to discover first, and a grid whose cells only exist after
            // an animation is a grid that cannot be relied on to take a tap.
        }
    }

    private func cell(_ character: CompanionCharacter, current: CompanionCharacter, caption: String?) -> some View {
        Button {
            Task { await store.selectCompanionCharacter(character) }
        } label: {
            VStack(spacing: 6) {
                if let caption {
                    Text(caption).font(.caption2.monospaced()).foregroundStyle(FeatureTheme.muted)
                }
                CompanionAvatar(store: store, character: character, equipped: nil, size: 64, thumbnail: true)
                Text(name(character)).font(.caption).foregroundStyle(FeatureTheme.ink)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(current == character ? FeatureTheme.accent : Color.white,
                        in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(FeatureTheme.border, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(store.companionBusy)
        .accessibilityIdentifier("companion.character.\(character.rawValue)")
        .accessibilityAddTraits(current == character ? [.isSelected] : [])
    }

    private func challenge(_ companion: CompanionSnapshot) -> some View {
        FeatureCard {
            Text(store.text("双人挑战", "Shared challenge")).font(.headline)
            if let challenge = companion.challenge {
                Text(store.text("邀请码 \(challenge.code)", "Invitation code \(challenge.code)"))
                    .font(.subheadline.monospaced())
                    .textSelection(.enabled)
                    .accessibilityIdentifier("companion.challenge.active")
                ForEach(Array(challenge.participants.enumerated()), id: \.offset) { entry in
                    HStack {
                        Text(entry.element.isSelf ? store.text("你", "You") : store.text("伙伴", "Partner"))
                            .foregroundStyle(FeatureTheme.ink)
                        Spacer(minLength: 0)
                        Text(store.text("\(entry.element.days) 天", "\(entry.element.days) days"))
                            .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                    }
                    .accessibilityIdentifier("companion.challenge.participant.\(entry.offset)")
                }
                Text(store.text("只共享参与天数，不共享任何饮食、训练或睡眠内容。",
                                "Only the number of days is shared — never any food, training or sleep content."))
                    .font(.caption2).foregroundStyle(FeatureTheme.muted)
                Button(store.text("离开挑战", "Leave challenge")) {
                    Task { await store.companionChallenge(.leave) }
                }
                .font(.subheadline)
                .disabled(store.companionBusy)
                .accessibilityIdentifier("companion.challenge.leave")
            } else {
                Text(store.text("和一个人一起记录。只共享参与天数。",
                                "Record alongside one other person. Only the day count is shared."))
                    .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                FeatureAction(title: store.text("创建邀请码", "Create an invitation"),
                              symbol: "person.2", identifier: "companion.challenge.create") {
                    Task { await store.companionChallenge(.create) }
                }
                .disabled(store.companionBusy)
                TextField(store.text("输入 16 位邀请码", "Enter a 16-character code"), text: $inviteCode)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("companion.challenge.code")
                Button(store.text("加入挑战", "Join challenge")) {
                    let code = inviteCode
                    Task {
                        await store.companionChallenge(.join(code))
                        if store.companionError == nil { inviteCode = "" }
                    }
                }
                .font(.subheadline)
                .disabled(store.companionBusy || AppStore.companionChallengeCode(inviteCode) == nil)
                .accessibilityIdentifier("companion.challenge.join")
            }
        }
    }

    // MARK: - Presentation

    private func name(_ character: CompanionCharacter) -> String {
        guard let detail = companionCharacterDetail(character) else { return character.rawValue }
        return store.language == "zh" ? detail.zh : detail.en
    }

    private func description(_ character: CompanionCharacter) -> String {
        guard let detail = companionCharacterDetail(character) else { return "" }
        return store.language == "zh" ? detail.descriptionZh : detail.descriptionEn
    }
}
