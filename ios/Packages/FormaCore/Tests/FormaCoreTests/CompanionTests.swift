import Foundation
import XCTest
@testable import FormaCore

final class CompanionTests: XCTestCase {
    private func decode(_ json: String) throws -> CompanionSnapshot {
        try JSONDecoder().decode(CompanionSnapshot.self, from: Data(json.utf8))
    }

    func testLevelMatchesTheSharedContractAtEveryBoundary() {
        XCTAssertEqual(companionLevel(xp: 0), 1)
        XCTAssertEqual(companionLevel(xp: 1), 1)
        XCTAssertEqual(companionLevel(xp: 99), 1)
        XCTAssertEqual(companionLevel(xp: 100), 2)
        XCTAssertEqual(companionLevel(xp: 199), 2)
        XCTAssertEqual(companionLevel(xp: 250), 3)
    }

    func testLevelProgressStaysInsideTheCurrentLevel() {
        func progress(_ xp: Int) -> Double {
            CompanionSnapshot(ruleVersion: 1, character: .sprout, day: "2026-10-22", xp: xp,
                              level: companionLevel(xp: xp), activeDays: 0, equipped: nil,
                              inventory: [], quests: [], chests: [], challenge: nil).levelProgress
        }
        XCTAssertEqual(progress(0), 0)
        XCTAssertEqual(progress(40), 0.4, accuracy: 0.0001)
        XCTAssertEqual(progress(99), 0.99, accuracy: 0.0001)
        XCTAssertEqual(progress(100), 0)
        XCTAssertEqual(progress(140), 0.4, accuracy: 0.0001)
    }

    func testRewardDayIsUTCAndDoesNotDriftWithTheDeviceTimeZone() throws {
        // 2026-10-22T23:30:00Z is already the 23rd in Shanghai and still the 22nd in Los Angeles.
        let instant = try XCTUnwrap(RecordDates.parseInstant("2026-10-22T23:30:00Z"))
        XCTAssertEqual(companionDay(instant), "2026-10-22")
        let early = try XCTUnwrap(RecordDates.parseInstant("2026-10-22T00:30:00Z"))
        XCTAssertEqual(companionDay(early), "2026-10-22")
        let justBefore = try XCTUnwrap(RecordDates.parseInstant("2026-10-21T23:59:59Z"))
        XCTAssertEqual(companionDay(justBefore), "2026-10-21")
    }

    func testFullSnapshotDecodesEveryContractField() throws {
        let snapshot = try decode("""
        {"ruleVersion":1,"character":"otter","day":"2026-10-22","xp":140,"level":2,"activeDays":6,
         "equipped":"leaf","inventory":["leaf","cap"],
         "quests":[{"id":"nutrition","completed":true,"xp":10},
                   {"id":"movement","completed":false,"xp":10},
                   {"id":"sleep","completed":true,"xp":10}],
         "chests":[{"id":"c3","milestone":3,"item":"leaf","openedAt":"2026-10-18T00:00:00Z"},
                   {"id":"c6","milestone":6,"item":null,"openedAt":null}],
         "challenge":{"id":"ch1","code":"0123456789ABCDEF","startsAt":"2026-10-20T00:00:00Z",
                      "endsAt":"2026-10-27T00:00:00Z",
                      "participants":[{"self":true,"days":4},{"self":false,"days":2}]}}
        """)
        XCTAssertEqual(snapshot.character, .otter)
        XCTAssertEqual(snapshot.day, "2026-10-22")
        XCTAssertEqual(snapshot.xp, 140)
        XCTAssertEqual(snapshot.level, 2)
        XCTAssertEqual(snapshot.activeDays, 6)
        XCTAssertEqual(snapshot.equipped, .leaf)
        XCTAssertEqual(snapshot.inventory, [.leaf, .cap])
        XCTAssertEqual(snapshot.quest(.nutrition)?.completed, true)
        XCTAssertEqual(snapshot.quest(.movement)?.completed, false)
        XCTAssertEqual(snapshot.quest(.sleep)?.xp, 10)
        XCTAssertEqual(snapshot.chests.count, 2)
        XCTAssertEqual(snapshot.chests[0].item, .leaf)
        XCTAssertTrue(snapshot.chests[0].isOpened)
        XCTAssertNil(snapshot.chests[1].item)
        XCTAssertFalse(snapshot.chests[1].isOpened)
        let challenge = try XCTUnwrap(snapshot.challenge)
        XCTAssertEqual(challenge.code, "0123456789ABCDEF")
        XCTAssertEqual(challenge.participants.first?.isSelf, true)
        XCTAssertEqual(challenge.participants.first?.days, 4)
        XCTAssertEqual(challenge.participants.last?.isSelf, false)
    }

    func testArchiveWithoutACharacterFallsBackToSprout() throws {
        let snapshot = try decode("""
        {"ruleVersion":1,"day":"2026-10-22","xp":0,"level":1,"activeDays":0,
         "equipped":null,"inventory":[],"quests":[],"chests":[],"challenge":null}
        """)
        XCTAssertEqual(snapshot.character, .sprout)
        XCTAssertNil(snapshot.equipped)
        XCTAssertTrue(snapshot.inventory.isEmpty)
        XCTAssertNil(snapshot.challenge)
    }

    func testUnknownCharacterItemAndQuestAreDroppedInsteadOfLosingTheSnapshot() throws {
        let snapshot = try decode("""
        {"ruleVersion":2,"character":"dragon","day":"2026-10-22","xp":210,"level":3,"activeDays":9,
         "equipped":"jetpack","inventory":["leaf","jetpack","crown"],
         "quests":[{"id":"nutrition","completed":true,"xp":10},{"id":"meditation","completed":true,"xp":10}],
         "chests":[{"id":"c3","milestone":3,"item":"jetpack","openedAt":"2026-10-18T00:00:00Z"}],
         "challenge":null}
        """)
        XCTAssertEqual(snapshot.ruleVersion, 2)
        XCTAssertEqual(snapshot.character, .sprout, "An unknown character must not discard real progress")
        XCTAssertEqual(snapshot.xp, 210)
        XCTAssertEqual(snapshot.level, 3)
        XCTAssertNil(snapshot.equipped, "An unknown equipped item is shown as nothing equipped")
        XCTAssertEqual(snapshot.inventory, [.leaf, .crown])
        XCTAssertEqual(snapshot.quests.map(\.id), [.nutrition])
        XCTAssertNil(snapshot.chests[0].item, "An unknown chest item stays unknown, not a wrong item")
        XCTAssertTrue(snapshot.chests[0].isOpened)
    }

    func testMissingLevelIsDerivedAndMissingCountsStayZeroOnly() throws {
        let snapshot = try decode("""
        {"character":"bear","day":"2026-10-22","xp":250,"inventory":[],"quests":[],"chests":[]}
        """)
        XCTAssertEqual(snapshot.ruleVersion, companionRuleVersion)
        XCTAssertEqual(snapshot.level, 3, "A level the service did not send is derived from XP")
        XCTAssertEqual(snapshot.activeDays, 0)
        XCTAssertEqual(snapshot.character, .bear)
    }

    func testSnapshotSurvivesAnEncodeDecodeRoundTripIncludingTheSelfKey() throws {
        let original = CompanionSnapshot(
            ruleVersion: 1, character: .seal, day: "2026-10-22", xp: 320, level: 4, activeDays: 11,
            equipped: .crown, inventory: [.leaf, .crown],
            quests: [CompanionQuestState(id: .sleep, completed: true, xp: 10)],
            chests: [CompanionChest(id: "c3", milestone: 3, item: .crown, openedAt: "2026-10-18T00:00:00Z")],
            challenge: CompanionChallenge(id: "ch", code: "AAAAAAAAAAAAAAAA",
                                          startsAt: "2026-10-20T00:00:00Z", endsAt: "2026-10-27T00:00:00Z",
                                          participants: [CompanionChallengeParticipant(isSelf: true, days: 3)])
        )
        let encoded = try JSONEncoder().encode(original)
        let wire = try JSONDecoder().decode(JSONValue.self, from: encoded)
        XCTAssertEqual(wire["challenge"]["participants"][0]["self"].boolValue, true,
                       "The wire contract uses \"self\", not \"isSelf\"")
        XCTAssertEqual(try JSONDecoder().decode(CompanionSnapshot.self, from: encoded), original)
    }

    func testEveryCharacterAndItemHasBilingualPresentationDetail() {
        XCTAssertEqual(CompanionCharacter.allCases.count, 6)
        XCTAssertEqual(CompanionItem.allCases.count, 6)
        XCTAssertEqual(CompanionQuest.allCases.count, 3)
        for character in CompanionCharacter.allCases {
            let detail = companionCharacterDetails[character]
            XCTAssertNotNil(detail, "\(character.rawValue) is missing presentation detail")
            XCTAssertFalse(detail?.zh.isEmpty ?? true)
            XCTAssertFalse(detail?.en.isEmpty ?? true)
            XCTAssertFalse(detail?.descriptionZh.isEmpty ?? true)
            XCTAssertFalse(detail?.descriptionEn.isEmpty ?? true)
            XCTAssertEqual(detail?.color.count, 7, "\(character.rawValue) needs a #rrggbb tint")
            XCTAssertEqual(detail?.color.first, Character("#"))
        }
    }

    func testDemoCompanionMatchesTheSharedDemoAndCarriesTodaysRewardDay() {
        let now = Date()
        let demo = demoCompanion(now: now)
        XCTAssertEqual(demo.character, .sprout)
        XCTAssertEqual(demo.xp, 140)
        XCTAssertEqual(demo.level, 2)
        XCTAssertEqual(demo.level, companionLevel(xp: demo.xp))
        XCTAssertEqual(demo.activeDays, 6)
        XCTAssertEqual(demo.equipped, .leaf)
        XCTAssertEqual(demo.inventory, [.leaf])
        XCTAssertEqual(demo.quests.map(\.id), [.nutrition, .movement, .sleep])
        XCTAssertEqual(demo.quests.map(\.completed), [true, false, true])
        XCTAssertEqual(demo.chests.count, 2)
        XCTAssertNil(demo.challenge)
        XCTAssertEqual(demo.day, companionDay(now))
    }
}

extension CompanionTests {
    func testMilestoneRewardsFollowTheServiceOrderAndWrapAround() {
        XCTAssertEqual(companionChestItem(milestone: 3), .leaf)
        XCTAssertEqual(companionChestItem(milestone: 6), .cap)
        XCTAssertEqual(companionChestItem(milestone: 9), .star)
        XCTAssertEqual(companionChestItem(milestone: 12), .scarf)
        XCTAssertEqual(companionChestItem(milestone: 15), .flower)
        XCTAssertEqual(companionChestItem(milestone: 18), .crown)
        XCTAssertEqual(companionChestItem(milestone: 21), .leaf)
        XCTAssertNil(companionChestItem(milestone: 0))
        XCTAssertNil(companionChestItem(milestone: 4))
        XCTAssertNil(companionChestItem(milestone: -3))
    }

    func testEquippingRefusesAnItemTheSnapshotDoesNotOwn() {
        let demo = demoCompanion()
        XCTAssertEqual(demo.inventory, [.leaf])
        XCTAssertEqual(demo.replacingEquipped(.leaf)?.equipped, .leaf)
        XCTAssertNil(demo.replacingEquipped(.crown), "An unowned item must be refused, as the service does")
        XCTAssertEqual(demo.replacingEquipped(nil)?.equipped, nil, "Taking the item off is always allowed")
    }

    func testOpeningAChestAddsItsMilestoneRewardExactlyOnce() throws {
        let demo = demoCompanion()
        let instant = try XCTUnwrap(RecordDates.parseInstant("2026-10-22T00:00:00Z"))
        let opened = try XCTUnwrap(demo.openingChest(id: "demo-6", at: instant))
        XCTAssertEqual(opened.chests[1].item, .cap, "Milestone 6 rewards the second item")
        XCTAssertEqual(opened.chests[1].openedAt, companionInstant(instant))
        XCTAssertTrue(opened.chests[1].openedAt?.hasPrefix("2026-10-22T00:00:00") ?? false)
        XCTAssertEqual(opened.inventory, [.leaf, .cap])
        XCTAssertNil(opened.openingChest(id: "demo-6"),
                     "Reopening an opened chest must not award a second item")
        XCTAssertNil(demo.openingChest(id: "nope"))
        XCTAssertEqual(demo.inventory, [.leaf], "The original snapshot is never mutated in place")
    }

    func testSelectingACharacterKeepsProgressAndWardrobe() {
        let demo = demoCompanion()
        let switched = demo.replacingCharacter(.seal)
        XCTAssertEqual(switched.character, .seal)
        XCTAssertEqual(switched.xp, demo.xp)
        XCTAssertEqual(switched.level, demo.level)
        XCTAssertEqual(switched.activeDays, demo.activeDays)
        XCTAssertEqual(switched.equipped, demo.equipped)
        XCTAssertEqual(switched.inventory, demo.inventory)
        XCTAssertEqual(switched.chests, demo.chests)
    }
}
