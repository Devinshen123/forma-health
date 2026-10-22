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
