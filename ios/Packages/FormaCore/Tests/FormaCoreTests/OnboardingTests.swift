import XCTest
@testable import FormaCore

final class OnboardingTests: XCTestCase {
    private let empty: JSONValue = .object(["profile": .null, "planVersions": .array([])])

    func testOnlyAnAccountWithoutAProfileIsAskedTheQuestions() {
        XCTAssertTrue(Onboarding.needed(empty))
        XCTAssertTrue(Onboarding.needed(.object([:])), "An absent profile is the same as an empty one")
        XCTAssertFalse(Onboarding.needed(.object(["profile": .object(["name": .string("A")])])))
    }

    func testEachStepRefusesWhatTheWebsiteRefuses() {
        var answers = OnboardingAnswers()
        XCTAssertNil(Onboarding.refusal(leaving: 0, answers))
        answers.trainingDays = 8
        XCTAssertEqual(Onboarding.refusal(leaving: 1, answers), .invalidTraining)
        answers.trainingDays = 3; answers.timeMinutes = 9
        XCTAssertEqual(Onboarding.refusal(leaving: 1, answers), .invalidTraining)
        answers.timeMinutes = 45.5
        XCTAssertEqual(Onboarding.refusal(leaving: 1, answers), .invalidTraining, "Minutes are whole numbers")
        answers.timeMinutes = 45
        XCTAssertNil(Onboarding.refusal(leaving: 1, answers))
        answers.sleepGoal = 3.5
        XCTAssertEqual(Onboarding.refusal(leaving: 3, answers), .invalidSleep)
        answers.sleepGoal = 7.5
        XCTAssertNil(Onboarding.refusal(leaving: 3, answers), "Half hours of sleep are allowed")
        answers.calorieTarget = 400
        XCTAssertEqual(Onboarding.refusal(leaving: 4, answers), .invalidNutrition)
        answers.calorieTarget = nil
        XCTAssertNil(Onboarding.refusal(leaving: 4, answers), "A blank target is no target, not an error")
        answers.goal = "bulk"
        XCTAssertEqual(Onboarding.refusal(leaving: 0, answers), .invalidChoice)
    }

    func testConfirmingWritesTheFirstPlanItsPointerAndAProfileOfExactlyTheServicesFields() throws {
        let answers = OnboardingAnswers(name: "  Sam  ", goal: "strength", trainingDays: 4, timeMinutes: 60,
                                        equipment: "home", sleepGoal: 7.5, calorieTarget: 2200)
        let documents = try Onboarding.documents(state: empty, answers: answers, accountName: "Account",
                                                 language: "zh", timezone: "Asia/Shanghai", newId: "plan-1")
        XCTAssertEqual(documents.map(\.collection), ["planVersions", "currentPlanId", "profile"])

        let plan = documents[0].value
        XCTAssertEqual(plan["reason"].stringValue, "onboarding.initial")
        XCTAssertEqual(plan["parentId"], .null, "A first plan has no parent")
        XCTAssertEqual(plan["trainingMinutes"].doubleValue, 60)
        XCTAssertEqual(plan["sleepHours"].doubleValue, 7.5)
        XCTAssertEqual(plan["calorieTarget"].doubleValue, 2200)
        XCTAssertEqual(plan["proteinTarget"], .null, "A blank target is saved as missing, not zero")
        XCTAssertEqual(documents[1].value.stringValue, "plan-1")

        let profile = try XCTUnwrap(documents[2].value.objectValue)
        XCTAssertEqual(Set(profile.keys), ["name", "goal", "experience", "trainingDays", "timeMinutes",
                                           "equipment", "allergies", "restrictions", "language", "units",
                                           "timezone", "sleepGoal", "cloudConsent", "aiConsent"],
                       "The service's profile schema is strict: one extra key and the save is refused")
        XCTAssertEqual(profile["name"]?.stringValue, "Sam")
        XCTAssertEqual(profile["timezone"]?.stringValue, "Asia/Shanghai")
        XCTAssertEqual(profile["cloudConsent"]?.boolValue, false)
    }

    func testAnswersNeverResetSettingsTheProfileAlreadyHas() throws {
        let state: JSONValue = .object([
            "profile": .object(["name": .string("Old"), "units": .string("imperial"),
                                "timezone": .string("Europe/London"), "aiConsent": .bool(true)]),
            "planVersions": .array([.object(["id": .string("plan-0"), "trainingMinutes": .number(30),
                                             "trainingDays": .number(3), "sleepHours": .number(8)])]),
            "currentPlanId": .string("plan-0"),
        ])
        let documents = try Onboarding.documents(state: state, answers: OnboardingAnswers(), accountName: nil,
                                                 language: "en", timezone: "Asia/Shanghai", newId: "plan-1")
        let profile = documents[2].value
        XCTAssertEqual(profile["units"].stringValue, "imperial")
        XCTAssertEqual(profile["timezone"].stringValue, "Europe/London", "The device's zone does not overwrite a chosen one")
        XCTAssertEqual(profile["aiConsent"].boolValue, true, "Consent is never withdrawn by answering questions")
        XCTAssertEqual(documents[0].value["parentId"].stringValue, "plan-0", "A new plan descends from the current one")
    }

    func testANameFallsBackToTheAccountThenToTheWebsitesDefault() throws {
        func name(_ typed: String, _ account: String?) throws -> String? {
            try Onboarding.documents(state: empty, answers: OnboardingAnswers(name: typed), accountName: account,
                                     language: "en", timezone: "UTC", newId: "p")[2].value["name"].stringValue
        }
        XCTAssertEqual(try name("", "Devin"), "Devin")
        XCTAssertEqual(try name("   ", nil), "Forma user")
    }

    func testAnInvalidAnswerRefusesTheWholeSave() {
        var answers = OnboardingAnswers()
        answers.trainingDays = 0
        XCTAssertThrowsError(try Onboarding.documents(state: empty, answers: answers, accountName: nil,
                                                      language: "en", timezone: "UTC", newId: "p")) {
            XCTAssertEqual($0 as? OnboardingError, .invalidTraining)
        }
        XCTAssertThrowsError(try Onboarding.documents(state: empty, answers: OnboardingAnswers(), accountName: nil,
                                                      language: "en", timezone: "Not/AZone", newId: "p")) {
            XCTAssertEqual($0 as? OnboardingError, .invalidTimezone)
        }
    }
}
