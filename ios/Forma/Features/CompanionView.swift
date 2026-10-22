import Foundation
import SwiftUI
import FormaCore

/// The companion growth page. XP, levels and streak days are game progress derived by the service
/// from whether a record exists — never a health score, and never a judgement about the records.
@MainActor
struct CompanionView: View {
    let store: AppStore
    @State private var inviteCode = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let companion = store.companion {
                    header(companion)
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

    private func header(_ companion: CompanionSnapshot) -> some View {
        FeatureCard {
            // A pushed page does not inherit the tab's demo banner, so it says so itself.
            RecordNotice(store: store, locked: false)
            if let error = store.companionError {
                Text(error).font(.footnote).foregroundStyle(.red)
                    .accessibilityIdentifier("companion.error")
            }
            HStack(alignment: .top, spacing: 16) {
                CompanionAvatar(store: store, character: companion.character, equipped: companion.equipped, size: 104)
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

    private func characters(_ companion: CompanionSnapshot) -> some View {
        FeatureCard {
            Text(store.text("选择伙伴", "Choose your companion")).font(.headline)
            Text(store.text("六个角色都免费；切换不会重置 XP、装扮或奖励。",
                            "All six are free; switching never resets XP, your wardrobe or rewards."))
                .font(.caption).foregroundStyle(FeatureTheme.muted)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 12) {
                ForEach(CompanionCharacter.allCases, id: \.rawValue) { character in
                    Button {
                        Task { await store.selectCompanionCharacter(character) }
                    } label: {
                        VStack(spacing: 6) {
                            CompanionAvatar(store: store, character: character, equipped: nil,
                                            size: 64, thumbnail: true)
                            Text(name(character)).font(.caption).foregroundStyle(FeatureTheme.ink)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(companion.character == character ? FeatureTheme.accent : Color.white,
                                    in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(FeatureTheme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(store.companionBusy)
                    .accessibilityIdentifier("companion.character.\(character.rawValue)")
                    .accessibilityAddTraits(companion.character == character ? [.isSelected] : [])
                }
            }
        }
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
        guard let detail = companionCharacterDetails[character] else { return character.rawValue }
        return store.language == "zh" ? detail.zh : detail.en
    }

    private func description(_ character: CompanionCharacter) -> String {
        guard let detail = companionCharacterDetails[character] else { return "" }
        return store.language == "zh" ? detail.descriptionZh : detail.descriptionEn
    }
}
