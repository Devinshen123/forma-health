import XCTest

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
            let entry = element(identifier)
            reveal(entry)
            XCTAssertTrue(entry.isHittable)
            entry.tap()
            let gate = element("workbench.demo-gate")
            XCTAssertTrue(gate.waitForExistence(timeout: 5))
            XCTAssertEqual(app.webViews.count, 0, "A demo must not create an authenticated workbench")
            let close = element("workbench.close")
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

        let add = element("nutrition.add")
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
        let save = element("record.save")
        XCTAssertTrue(save.exists)
        XCTAssertFalse(save.isEnabled, "Even a valid demo form must not save personal account data")
        let cancel = element("record.cancel")
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

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
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

    private func reveal(_ target: XCUIElement) {
        if waitUntilHittable(target, timeout: 1) { return }
        for _ in 0..<5 {
            app.swipeUp()
            if waitUntilHittable(target, timeout: 1) { return }
        }
        XCTAssertTrue(target.waitForExistence(timeout: 5))
        XCTAssertTrue(target.isHittable, "The native control must be reachable through normal scrolling")
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
        let settings = element("settings.open")
        XCTAssertTrue(waitUntilHittable(settings))
        settings.tap()
        let picker = app.segmentedControls.matching(identifier: "settings.language").firstMatch
        XCTAssertTrue(picker.waitForExistence(timeout: 5))
        let option = picker.buttons[label]
        XCTAssertTrue(waitUntilHittable(option))
        option.tap()
        let done = element("settings.done")
        XCTAssertTrue(waitUntilHittable(done))
        done.tap()
    }

    private func waitUntilHittable(_ target: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            target.exists && target.isHittable
        }, object: nil)
        return XCTWaiter.wait(for: [ready], timeout: timeout) == .completed
    }
}
