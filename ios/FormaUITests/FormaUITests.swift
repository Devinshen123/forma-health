import XCTest
import CoreGraphics

/// Launches an isolated, in-memory demo. No backend, saved account or Keychain is used.
final class FormaUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()
        XCTAssertTrue(element("demo.banner").waitForExistence(timeout: 10))
        XCTAssertTrue(element("demo.banner").label.contains("演示数据"))
    }

    override func tearDownWithError() throws {
        app?.terminate()
        app = nil
    }

    func testAllFiveTabsAreNativeAndKeepTheDemoLabel() throws {
        let tabs = [
            ("today", "今日", "Today"),
            ("nutrition", "饮食", "Nutrition"),
            ("training", "训练", "Training"),
            ("sleep", "睡眠", "Sleep"),
            ("trends", "趋势", "Trends"),
        ]
        XCTAssertEqual(app.tabBars.buttons.count, 5)
        for (key, chinese, english) in tabs {
            selectTab(key, chinese: chinese, english: english)
            assertScreen(key)
            XCTAssertTrue(element("demo.banner").exists)
            XCTAssertTrue(element("demo.banner").label.contains("演示数据"))
            XCTAssertEqual(app.webViews.count, 0, "The native tab must not be a website wrapper")
        }
    }

    func testDemoTotalsUseEnteredFactsAndKeepUnknownSetDetailsMissing() throws {
        selectTab("today", chinese: "今日", english: "Today")
        assertMetric("today.nutrition.kcal", equals: 500)
        assertMetric("today.training.minutes", equals: 30)
        assertMetric("today.sleep.hours", equals: 8)

        selectTab("nutrition", chinese: "饮食", english: "Nutrition")
        assertMetric("nutrition.total.kcal", equals: 500)
        assertMetric("nutrition.total.protein", equals: 25)
        assertMetric("nutrition.total.carbs", equals: 50)
        assertMetric("nutrition.total.fat", equals: 12.5)

        selectTab("training", chinese: "训练", english: "Training")
        assertMetric("training.summary.minutes", equals: 30)
        XCTAssertEqual(metricText("training.summary.sets"), "—")
        XCTAssertEqual(metricText("training.summary.volume"), "—")

        selectTab("sleep", chinese: "睡眠", english: "Sleep")
        assertMetric("sleep.total.hours", equals: 8)
    }

    func testAllTrainingWorkbenchEntrypointsRequireAnAccountInDemo() throws {
        selectTab("training", chinese: "训练", english: "Training")
        for identifier in ["training.workbench", "training.library", "training.statistics"] {
            let entry = button(identifier)
            reveal(entry)
            XCTAssertTrue(entry.isHittable)
            entry.tap()
            let gate = element("workbench.demo-gate")
            XCTAssertTrue(gate.waitForExistence(timeout: 5))
            XCTAssertEqual(app.webViews.count, 0, "A demo must not create an authenticated workbench")
            let close = button("workbench.close")
            XCTAssertTrue(waitUntilHittable(close))
            close.tap()
            assertScreen("training")
            XCTAssertTrue(entry.waitForExistence(timeout: 5))
        }
    }

    func testLanguageSwitchAndValidDemoFormCannotSaveARealRecord() throws {
        setLanguage("English")
        selectTab("nutrition", chinese: "饮食", english: "Nutrition")
        assertScreen("nutrition")
        XCTAssertTrue(element("demo.banner").label.contains("Demo data"))
        XCTAssertTrue(app.tabBars.buttons["Nutrition"].exists)
        assertMetric("nutrition.total.kcal", equals: 500)

        let add = button("nutrition.add")
        reveal(add)
        add.tap()
        XCTAssertTrue(element("demo.form").waitForExistence(timeout: 5))
        XCTAssertTrue(element("record.demo.notice").exists)
        for (identifier, value) in [
            ("record.name", "Synthetic UI meal"),
            ("record.grams", "150"),
            ("record.kcal", "250"),
            ("record.protein", "20"),
            ("record.carbs", "30"),
            ("record.fat", "5"),
        ] {
            replaceText(identifier, with: value)
        }
        let save = button("record.save")
        XCTAssertTrue(save.exists)
        XCTAssertFalse(save.isEnabled, "Even a valid demo form must not save personal account data")
        let cancel = button("record.cancel")
        XCTAssertTrue(waitUntilHittable(cancel))
        cancel.tap()
        assertScreen("nutrition")
        assertMetric("nutrition.total.kcal", equals: 500)
        assertMetric("nutrition.total.protein", equals: 25)

        setLanguage("简体中文")
        XCTAssertTrue(app.tabBars.buttons["饮食"].exists)
        XCTAssertTrue(element("demo.banner").label.contains("演示数据"))
        assertMetric("nutrition.total.kcal", equals: 500)
    }

    func testCompanionGrowthPageIsNativeAndDemoProgressNeverReachesAnAccount() throws {
        selectTab("today", chinese: "今日", english: "Today")

        let card = element("companion.card")
        XCTAssertTrue(card.waitForExistence(timeout: 10), "The today page must show the companion card")
        let summary = element("companion.card.summary").label
        XCTAssertTrue(summary.contains("2"), "The demo companion is level 2: \(summary)")
        reveal(card)
        card.tap()

        assertScreen("companion")
        attachScreenshot("Native companion page")
        XCTAssertEqual(app.webViews.count, 0, "The companion page must not be a website wrapper")
        XCTAssertTrue(element("record.demo.notice").waitForExistence(timeout: 5),
                      "A page that can change things must say it is a demo")
        XCTAssertTrue(element("companion.level").label.contains("2"))
        XCTAssertTrue(element("companion.activeDays").label.contains("6"))

        // XP is game progress. The page must say so rather than read as a health score.
        let xpBefore = element("companion.xp").label
        XCTAssertTrue(xpBefore.contains("140"), "Demo XP is 140: \(xpBefore)")

        // The three demo quests are shown with their real completed state, not as zero.
        for quest in ["nutrition", "movement", "sleep"] {
            XCTAssertTrue(element("companion.quest.\(quest)").exists, "\(quest) task is missing")
        }

        // Claiming in a demo must refuse and must not invent progress.
        let claim = button("companion.claim")
        reveal(claim)
        claim.tap()
        XCTAssertTrue(element("companion.error").waitForExistence(timeout: 5),
                      "A demo claim must explain that nothing is saved")
        XCTAssertEqual(element("companion.xp").label, xpBefore, "A demo claim must not change XP")

        // Opening the milestone-6 chest awards exactly the contract's second item.
        let chest = element("companion.chest.demo-6.open")
        XCTAssertTrue(chest.waitForExistence(timeout: 5), "A closed chest must offer to open")
        reveal(chest, attempts: 24)
        chest.tap()
        XCTAssertTrue(element("companion.chest.demo-6.opened").waitForExistence(timeout: 5),
                      "The chest must read as opened afterwards")
        let cap = element("companion.item.cap")
        XCTAssertTrue(cap.waitForExistence(timeout: 5), "Opening day 6 must award the second accessory")
        reveal(cap, attempts: 24)
        cap.tap()
        XCTAssertTrue(waitUntilSelected(cap), "The newly awarded accessory must be wearable")

        // Every character is free, and switching keeps XP, the wardrobe and rewards.
        let seal = element("companion.character.seal")
        reveal(seal, attempts: 24)
        seal.tap()
        XCTAssertTrue(waitUntilSelected(seal), "Choosing a character must take effect")
        XCTAssertEqual(element("companion.xp").label, xpBefore, "Switching character must not reset XP")
        XCTAssertTrue(element("companion.activeDays").label.contains("6"))
        XCTAssertTrue(element("companion.item.cap").exists, "The wardrobe survives a character switch")
        attachScreenshot("Companion after switching character")
    }

    func testCompanionInviteCodeIsRefusedUntilItMatchesTheServiceFormat() throws {
        selectTab("today", chinese: "今日", english: "Today")
        let card = element("companion.card")
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        reveal(card)
        card.tap()
        assertScreen("companion")

        // `isEnabled` is read from the accessibility tree, so these checks do not depend on the
        // on-screen keyboard having moved out of the way.
        let join = button("companion.challenge.join")
        XCTAssertTrue(join.waitForExistence(timeout: 10))
        XCTAssertFalse(join.isEnabled, "An empty invitation cannot be submitted")
        let field = element("companion.challenge.code")
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        reveal(field, attempts: 24)
        field.tap()
        field.typeText("0123456789abcde")
        XCTAssertFalse(join.isEnabled, "A 15-character invitation cannot be submitted")
        field.typeText("f")
        XCTAssertTrue(join.isEnabled, "A well-formed invitation can be submitted, lower case included")
    }

    func testPlanPageIsNativeAndADemoPlanCannotBeSaved() throws {
        selectTab("today", chinese: "今日", english: "Today")

        let card = element("plan.card")
        XCTAssertTrue(card.waitForExistence(timeout: 10), "The today page must link to the plan")
        XCTAssertTrue(element("plan.card.summary").label.contains("3"),
                      "The demo plan is 3 days a week: \(element("plan.card.summary").label)")
        reveal(card, attempts: 24)
        card.tap()

        assertScreen("plan")
        attachScreenshot("Native plan page")
        XCTAssertEqual(app.webViews.count, 0, "The plan page must not be a website wrapper")
        XCTAssertTrue(element("record.demo.notice").waitForExistence(timeout: 5),
                      "A page that can change things must say it is a demo")

        // The demo plan's own values, and its unset targets shown as missing rather than zero.
        XCTAssertEqual(element("plan.trainingDays").label, "3")
        XCTAssertEqual(element("plan.trainingMinutes").label, "45")
        XCTAssertEqual(element("plan.sleepHours").label, "8")
        XCTAssertEqual(element("plan.calorieTarget").label, "—", "An unset target must never read as 0")
        XCTAssertEqual(element("plan.proteinTarget").label, "—", "An unset target must never read as 0")
        XCTAssertTrue(element("plan.suggestions.empty").exists, "The demo has nothing awaiting a decision")
        XCTAssertTrue(element("plan.history.count").label.contains("1"), "One version so far")

        // Editing refuses an unchanged or out-of-range plan before anything is sent.
        let edit = button("plan.edit")
        reveal(edit, attempts: 24)
        edit.tap()
        let save = button("plan.editor.save")
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        XCTAssertTrue(save.isEnabled, "The starting values are themselves valid")
        replaceText("plan.editor.sleepHours", with: "20")
        XCTAssertFalse(save.isEnabled, "Sleep outside 4–12 hours cannot be saved")
        replaceText("plan.editor.sleepHours", with: "7")
        XCTAssertTrue(save.isEnabled, "A valid change can be submitted")

        // A demo save must be refused in words, and must not pretend to have saved.
        save.tap()
        XCTAssertTrue(element("plan.editor.error").waitForExistence(timeout: 5),
                      "A demo plan save must explain that nothing is stored")
        let cancel = button("plan.editor.cancel")
        XCTAssertTrue(waitUntilHittable(cancel))
        cancel.tap()
        XCTAssertTrue(element("plan.trainingDays").waitForExistence(timeout: 5))
        XCTAssertEqual(element("plan.sleepHours").label, "8", "The refused demo edit changed nothing")
    }

    func testReportsPageIsNativeAndSaysUploadIsNotHereYet() throws {
        selectTab("today", chinese: "今日", english: "Today")

        let card = element("reports.card")
        XCTAssertTrue(card.waitForExistence(timeout: 10), "The today page must link to reports")
        reveal(card, attempts: 24)
        card.tap()
        // Attached before the assertion, so a failure to arrive shows what is on screen instead.
        attachScreenshot("After tapping the reports card")

        assertScreen("reports")
        attachScreenshot("Native reports page")
        XCTAssertEqual(app.webViews.count, 0, "The reports page must not be a website wrapper")
        XCTAssertTrue(element("record.demo.notice").waitForExistence(timeout: 5),
                      "A page that can change things must say it is a demo")
        // The one capability this build does not have must be stated, not left to be discovered.
        XCTAssertTrue(element("reports.upload.notice").exists,
                      "The page must say that uploading an original is not in this build")

        // Typing a marker is refused until it is complete, before anything is sent.
        let new = button("reports.new")
        XCTAssertTrue(new.waitForExistence(timeout: 5))
        new.tap()
        let save = button("reports.editor.save")
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        XCTAssertFalse(save.isEnabled, "A blank report cannot be saved")
        replaceText("reports.editor.name", with: "Synthetic panel")
        XCTAssertFalse(save.isEnabled, "A name alone is not a report")

        replaceText("reports.editor.marker.0.name", with: "Ferritin")
        XCTAssertFalse(save.isEnabled, "A marker without its value is incomplete")
        replaceText("reports.editor.marker.0.value", with: "42")
        XCTAssertTrue(save.isEnabled, "A named marker with its value can be submitted")

        // A demo save must be refused in words and must not pretend to have stored anything.
        save.tap()
        XCTAssertTrue(element("reports.editor.error").waitForExistence(timeout: 5),
                      "A demo report save must explain that nothing is stored")
        let cancel = button("reports.editor.cancel")
        XCTAssertTrue(waitUntilHittable(cancel))
        cancel.tap()
        XCTAssertTrue(element("screen.reports").waitForExistence(timeout: 5))
    }

    private func waitUntilSelected(_ target: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            target.exists && target.isSelected
        }, object: nil)
        return XCTWaiter.wait(for: [ready], timeout: timeout) == .completed
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func button(_ identifier: String) -> XCUIElement {
        app.buttons.matching(identifier: identifier).firstMatch
    }

    private func selectTab(_ key: String, chinese: String, english: String) {
        // UIKit may discard the SwiftUI tabItem identifier; the real button's
        // two app-controlled labels are a deterministic alternative.
        let predicate = NSPredicate(format: "identifier == %@ OR label == %@ OR label == %@", "tab.\(key)", chinese, english)
        let tab = app.tabBars.buttons.matching(predicate).firstMatch
        XCTAssertTrue(tab.waitForExistence(timeout: 5))
        XCTAssertTrue(waitUntilHittable(tab))
        tab.tap()
        assertScreen(key)
        attachScreenshot("Native tab \(key)")
    }

    private func assertScreen(_ key: String) {
        XCTAssertTrue(element("screen.\(key)").waitForExistence(timeout: 5))
    }

    private func metricText(_ identifier: String) -> String {
        readMetric(identifier).text
    }

    private func assertMetric(_ identifier: String, equals expected: Double) {
        let reading = readMetric(identifier)
        let displayed = numericText(reading.text)
        guard let value = Double(displayed) else {
            attachMetricFailure(identifier)
            XCTFail("The demo metric \(identifier) must expose a recorded numeric value. \(reading.diagnostic)")
            return
        }
        if abs(value - expected) > 0.001 { attachMetricFailure(identifier) }
        XCTAssertEqual(value, expected, accuracy: 0.001, "Metric \(identifier). \(reading.diagnostic)")
    }

    private func readMetric(_ identifier: String) -> (text: String, diagnostic: String) {
        // A SwiftUI Text is a StaticText. A broad descendant query can instead
        // resolve a containing accessibility element with an unrelated value.
        let textQuery = app.staticTexts.matching(identifier: identifier)
        let staticText = textQuery.firstMatch
        let fallback = element(identifier)
        if !staticText.exists && !fallback.exists { reveal(fallback) }
        let metric = staticText.exists ? staticText : fallback
        XCTAssertTrue(metric.waitForExistence(timeout: 5))
        let label = metric.label.trimmingCharacters(in: .whitespacesAndNewlines)
        let rawValue = metric.value
        let value = (rawValue as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        // StaticText can expose an empty/non-numeric AX value while its actual
        // displayed number lives in label. Never replace it with a test value.
        let displayed = Double(numericText(value)) == nil ? label : value
        let diagnostic = "label=\(String(reflecting: label)); value=\(String(reflecting: rawValue)); element=\(metric.debugDescription); staticTextMatches=\(textQuery.debugDescription)"
        return (displayed, diagnostic)
    }

    private func numericText(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: "")
    }

    private func attachScreenshot(_ name: String) {
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = name
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }

    private func attachMetricFailure(_ identifier: String) {
        attachScreenshot("Metric failure \(identifier)")
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "Accessibility tree \(identifier)"
        tree.lifetime = .keepAlways
        add(tree)
    }

    private func reveal(_ target: XCUIElement, attempts: Int = 8) {
        let scroll = activeScrollContainer()
        for _ in 0..<attempts {
            let viewport = contentViewport(scroll)
            if target.exists {
                let frame = target.frame
                if validFrame(frame) && viewport.contains(frame) {
                    attachControlGeometry(target, viewport: viewport)
                    XCTAssertTrue(waitUntilHittable(target), "A fully visible native control must be hittable: \(target.identifier)")
                    return
                }
                // An upward-only swipe can move a top-of-page action away from
                // the user. Read geometry first; do not ask AX to hit-test an
                // empty/offscreen frame, which itself raises an XCTest issue.
                if validFrame(frame) && frame.minY < viewport.minY {
                    scroll.swipeDown()
                } else {
                    scroll.swipeUp()
                }
            } else {
                scroll.swipeUp()
            }
        }
        attachControlGeometry(target, viewport: contentViewport(scroll))
        XCTFail("The native control \(target.identifier) did not become fully visible through normal scrolling")
    }

    private func activeScrollContainer() -> XCUIElement {
        let form = app.collectionViews.firstMatch
        if form.exists { return form }
        let scroll = app.scrollViews.firstMatch
        return scroll.exists ? scroll : app
    }

    private func contentViewport(_ scroll: XCUIElement) -> CGRect {
        var viewport = app.frame.intersection(scroll.frame)
        for bar in app.navigationBars.allElementsBoundByIndex where bar.exists {
            let frame = bar.frame
            if validFrame(frame) && frame.intersects(viewport) {
                let top = max(viewport.minY, frame.maxY)
                viewport = CGRect(x: viewport.minX, y: top, width: viewport.width, height: max(0, viewport.maxY - top))
            }
        }
        let banner = element("demo.banner")
        if banner.exists && validFrame(banner.frame) && banner.frame.intersects(viewport) {
            let top = max(viewport.minY, banner.frame.maxY)
            viewport = CGRect(x: viewport.minX, y: top, width: viewport.width, height: max(0, viewport.maxY - top))
        }
        for cover in [app.tabBars.firstMatch, app.keyboards.firstMatch] where cover.exists {
            let frame = cover.frame
            if validFrame(frame) && frame.intersects(viewport) {
                viewport = CGRect(x: viewport.minX, y: viewport.minY, width: viewport.width, height: max(0, min(viewport.maxY, frame.minY) - viewport.minY))
            }
        }
        return viewport.insetBy(dx: 1, dy: 1)
    }

    private func validFrame(_ frame: CGRect) -> Bool {
        !frame.isNull && !frame.isInfinite && frame.width > 0 && frame.height > 0 &&
        [frame.minX, frame.minY, frame.width, frame.height].allSatisfy { $0.isFinite }
    }

    private func attachControlGeometry(_ target: XCUIElement, viewport: CGRect) {
        attachScreenshot("Control \(target.identifier) before hit-test")
        let details = "target=\(target.debugDescription)\nframe=\(target.frame)\ncontentViewport=\(viewport)\napplicationFrame=\(app.frame)\n\(app.debugDescription)"
        let tree = XCTAttachment(string: details)
        tree.name = "Control geometry \(target.identifier)"
        tree.lifetime = .keepAlways
        add(tree)
    }

    private func replaceText(_ identifier: String, with value: String) {
        let field = app.textFields.matching(identifier: identifier).firstMatch
        reveal(field)
        field.tap()
        let previous = (field.value as? String) ?? ""
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: previous.count) + value)
        XCTAssertEqual(field.value as? String, value)
    }

    private func setLanguage(_ label: String) {
        let settings = button("settings.open")
        XCTAssertTrue(waitUntilHittable(settings))
        settings.tap()
        let picker = app.segmentedControls.matching(identifier: "settings.language").firstMatch
        XCTAssertTrue(picker.waitForExistence(timeout: 5))
        let option = picker.buttons[label]
        XCTAssertTrue(waitUntilHittable(option))
        option.tap()
        let done = button("settings.done")
        XCTAssertTrue(waitUntilHittable(done))
        done.tap()
    }

    private func waitUntilHittable(_ target: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            guard target.exists else { return false }
            let frame = target.frame
            guard self.validFrame(frame), self.app.frame.contains(frame) else { return false }
            return target.isHittable
        }, object: nil)
        return XCTWaiter.wait(for: [ready], timeout: timeout) == .completed
    }
}
