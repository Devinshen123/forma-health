import SwiftUI
import Charts
import FormaCore

private struct FeatureTrendDay: Identifiable {
    let date: Date
    let metrics: DayMetrics
    var id: String { metrics.day }
}

private struct FeatureTrendPoint: Identifiable {
    let date: Date
    let value: Double
    var id: Date { date }
}

@MainActor
struct TrendsView: View {
    let store: AppStore
    @State private var workbench: FeatureWorkbenchRoute?

    private var days: [FeatureTrendDay] {
        let calendar = Calendar.current, today = calendar.startOfDay(for: Date())
        return (-6...0).compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { return nil }
            return FeatureTrendDay(date: day, metrics: Metrics.dailySummary(state: store.state, date: day))
        }
    }

    var body: some View {
        let recordedDays = days
        let range = Metrics.summary(state: store.state, days: recordedDays.map { $0.metrics.day })
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                FeatureCard {
                    Text(store.text("最近7天", "Last 7 days")).font(.title2.weight(.semibold))
                    Text(store.text("只展示真实已记录数据。平均值排除未记录的天，并标明记录完整度。", "Charts use real records. Averages exclude unrecorded days, and coverage is shown."))
                        .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                    if store.isDemo { Text(store.text("演示数据", "Demo data")).font(.caption.weight(.semibold)) }
                }
                FeatureTrendChart(
                    title: store.text("饮食能量", "Food energy"), unit: "kcal", language: store.language,
                    points: points(recordedDays) { $0.nutrition?.kcal },
                    summaryTitle: store.text("记录日平均", "Average on recorded days"),
                    summaryValue: range.nutritionDays > 0 ? range.nutrition.map { $0.kcal / Double(range.nutritionDays) } : nil,
                    coverage: coverage(range.nutritionDays), identifier: "trends.nutrition"
                )
                FeatureTrendChart(
                    title: store.text("训练时间", "Training time"), unit: store.text("分钟", "min"), language: store.language,
                    points: points(recordedDays) { $0.trainingMinutes },
                    summaryTitle: store.text("已记录总时长", "Recorded total"), summaryValue: range.trainingMinutes,
                    coverage: coverage(range.trainingDays), identifier: "trends.training"
                )
                FeatureTrendChart(
                    title: store.text("睡眠时长", "Sleep duration"), unit: store.text("小时", "hours"), language: store.language,
                    points: points(recordedDays) { $0.sleepHours },
                    summaryTitle: store.text("记录日平均", "Average on recorded days"),
                    summaryValue: range.sleepDays > 0 ? range.sleepHours.map { $0 / Double(range.sleepDays) } : nil,
                    coverage: coverage(range.sleepDays), identifier: "trends.sleep"
                )
                FeatureCard {
                    Text(store.text("更多训练明细", "More training detail")).font(.headline)
                    Text(store.text("工作台内查看训练热图、动作进步和逐组统计。工作台图表仅含其原始记录，原生汇总未反向加入。", "Open the workbench for the training heatmap, exercise progress and set statistics. Its charts use workbench records; native summaries are not copied back."))
                        .font(.footnote).foregroundStyle(FeatureTheme.muted)
                    FeatureAction(title: store.text("打开详细训练统计", "Open detailed training statistics"), symbol: "chart.bar", identifier: "trends.workbench") { workbench = .stats }
                }
            }.padding(20)
        }
        .background(FeatureTheme.background)
        .navigationTitle(store.text("趋势", "Trends"))
        .refreshable { await store.refresh() }
        .sheet(item: $workbench) { route in FeatureWorkbenchSheet(store: store, route: route) }
        .accessibilityIdentifier("screen.trends")
    }

    private func points(_ days: [FeatureTrendDay], value: (DayMetrics) -> Double?) -> [FeatureTrendPoint] {
        days.compactMap { day in
            guard let number = value(day.metrics), number.isFinite else { return nil }
            return FeatureTrendPoint(date: day.date, value: number)
        }
    }

    private func coverage(_ count: Int) -> String {
        store.text("7天中记录了\(count)天；未记录日期不填0。", "Records on \(count) of 7 days; missing days are not filled with zero.")
    }
}

@MainActor
private struct FeatureTrendChart: View {
    let title: String
    let unit: String
    let language: String
    let points: [FeatureTrendPoint]
    let summaryTitle: String
    let summaryValue: Double?
    let coverage: String
    let identifier: String

    var body: some View {
        FeatureCard {
            Text(title).font(.headline)
            FeatureMetric(title: summaryTitle, value: FeatureFormat.number(summaryValue, language: language), unit: unit, identifier: identifier + ".value")
            if points.isEmpty {
                Text(language == "zh" ? "— 尚无这段日期的有效记录。" : "— No usable records in this date range.")
                    .font(.subheadline).foregroundStyle(FeatureTheme.muted).frame(maxWidth: .infinity, minHeight: 100)
            } else {
                Chart(points) { point in
                    BarMark(x: .value("Date", point.date, unit: .day), y: .value("Value", point.value))
                        .foregroundStyle(FeatureTheme.accent)
                        .accessibilityLabel(point.date.formatted(date: .abbreviated, time: .omitted))
                        .accessibilityValue(FeatureFormat.number(point.value, language: language) + " " + unit)
                }
                .chartXAxis { AxisMarks(values: .stride(by: .day)) { _ in AxisValueLabel(format: .dateTime.weekday(.narrow)) } }
                .chartYAxis { AxisMarks(position: .leading) }
                .frame(height: 160)
                .environment(\.locale, Locale(identifier: language == "zh" ? "zh_CN" : "en_US"))
                .accessibilityIdentifier(identifier + ".chart")
            }
            Text(coverage).font(.footnote).foregroundStyle(FeatureTheme.muted)
        }
    }
}
