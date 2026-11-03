import SwiftUI
import FormaCore

@MainActor
struct TodayView: View {
    let store: AppStore

    private var summary: DayMetrics { Metrics.dailySummary(state: store.state, date: Date()) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                FeatureCard {
                    Text(store.text("今天，保持你的节奏。", "Keep your rhythm today.")).font(.title2.weight(.semibold))
                    Text(store.text("训练、饮食与休息，一起向前。", "Move forward with training, food and rest."))
                        .foregroundStyle(FeatureTheme.muted)
                    if store.isDemo { Text(store.text("演示数据", "Demo data")).font(.caption.weight(.semibold)) }
                }
                CompanionCard(store: store)
                PlanCard(store: store)
                ReportsCard(store: store)
                FeatureCard {
                    FeatureMetric(title: store.text("饮食摄入", "Food recorded"), value: FeatureFormat.number(summary.nutrition?.kcal, language: store.language), unit: "kcal", identifier: "today.nutrition.kcal")
                    Text(store.text("今天记录了 \(summary.mealRecords) 条饮食；未记录不代表没有进食。", "\(summary.mealRecords) food records today; unrecorded meals are not counted as zero."))
                        .font(.footnote).foregroundStyle(FeatureTheme.muted)
                }
                FeatureCard {
                    FeatureMetric(title: store.text("训练时间", "Training time"), value: FeatureFormat.number(summary.trainingMinutes, language: store.language), unit: store.text("分钟 · 已保存记录", "min · saved records"), identifier: "today.training.minutes")
                }
                FeatureCard {
                    FeatureMetric(title: store.text("睡眠", "Sleep"), value: FeatureFormat.number(summary.sleepHours, language: store.language), unit: store.text("小时 · 按醒来日期", "hours · by wake-up date"), identifier: "today.sleep.hours")
                }
                WeeklyRhythmCard(store: store)
                if summary.mealRecords + summary.workoutRecords + summary.sleepRecords == 0 {
                    FeatureEmpty(title: store.text("从一条记录开始", "Start with one record"), message: store.text("在饮食、训练或睡眠页面保存真实记录，这里会显示当天汇总。", "Save a real food, training or sleep record to see your daily summary."), symbol: "square.and.pencil")
                }
            }
            .padding(20)
        }
        .background(FeatureTheme.background)
        .navigationTitle(store.text("今日", "Today"))
        .refreshable { await store.refresh() }
        .accessibilityIdentifier("screen.today")
    }
}

/// The website dashboard's "weekly rhythm": training minutes on each of the last seven days,
/// how many workouts that holds and on how many days food was recorded. A day with nothing
/// recorded shows a dash and a stub, never a zero-height bar that would read as "did nothing".
@MainActor
struct WeeklyRhythmCard: View {
    let store: AppStore

    private var rhythm: WeeklyRhythm { Metrics.weeklyRhythm(state: store.state) }

    var body: some View {
        let rhythm = rhythm
        FeatureCard {
            HStack {
                Text(store.text("本周节奏", "Weekly rhythm")).font(.headline)
                Spacer(minLength: 0)
                Text(store.text("训练分钟", "Training minutes")).font(.caption).foregroundStyle(FeatureTheme.muted)
            }
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(Array(rhythm.days.enumerated()), id: \.offset) { index, day in
                    column(day, isToday: index == rhythm.days.count - 1)
                }
            }
            .frame(height: 120)
            HStack(alignment: .top) {
                summary(value: rhythm.workouts, unit: store.text(" 次训练", " workouts"),
                        caption: store.text("本周已完成", "Logged this week"), id: "today.week.workouts")
                Spacer(minLength: 0)
                summary(value: rhythm.mealDays, unit: store.text(" 天有饮食记录", " food days"),
                        caption: store.text("共 7 天", "Out of 7 days"), id: "today.week.mealDays")
            }
        }
        // No identifier on the card itself: one on a container folds its children into a single
        // element, and the two counts inside would vanish from VoiceOver and from the tests.
    }

    private func column(_ day: WeekDay, isToday: Bool) -> some View {
        let minutes = day.trainingMinutes
        // The website's scale: an hour fills the bar, anything recorded is at least visible.
        let fraction = minutes.map { max(0.08, min($0 / 60, 1)) }
        return VStack(spacing: 4) {
            Text(minutes.map { FeatureFormat.number($0, language: store.language, digits: 0) } ?? "—")
                .font(.caption2).foregroundStyle(FeatureTheme.muted)
                .lineLimit(1).minimumScaleFactor(0.6)
            GeometryReader { proxy in
                VStack {
                    Spacer(minLength: 0)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(isToday ? FeatureTheme.accent : FeatureTheme.ink.opacity(minutes == nil ? 0.12 : 0.55))
                        .frame(height: fraction.map { proxy.size.height * $0 } ?? 4)
                }
            }
            Text(weekday(day.day)).font(.caption2).foregroundStyle(isToday ? FeatureTheme.ink : FeatureTheme.muted)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(day.day): " + (minutes.map {
            store.text("\(FeatureFormat.number($0, language: store.language, digits: 0)) 分钟",
                       "\(FeatureFormat.number($0, language: store.language, digits: 0)) min")
        } ?? store.text("无记录", "Not logged")))
    }

    private func summary(value: Int, unit: String, caption: String, id: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            (Text("\(value)").font(.title3.weight(.semibold)) + Text(unit).font(.subheadline))
            Text(caption).font(.caption).foregroundStyle(FeatureTheme.muted)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(id)
    }

    private func weekday(_ day: String) -> String {
        guard let date = try? NativeReports.day(day) else { return "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: store.language == "zh" ? "zh_CN" : "en_US")
        formatter.setLocalizedDateFormatFromTemplate("EEE")
        return formatter.string(from: date)
    }
}
