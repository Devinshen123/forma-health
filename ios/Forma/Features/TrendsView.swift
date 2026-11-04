import SwiftUI
import Charts
import FormaCore

private struct TrendPoint {
    let segment: Int
    let index: Int
    let value: Double
}

/// Native counterpart of the website's Trends page (src/features/Trends.tsx). Read-only: it never
/// writes a record, so the demo has nothing it could save to an account.
@MainActor
struct TrendsView: View {
    let store: AppStore
    @State private var range: TrendRange = .week
    @State private var metric: TrendMetric = .nutrition
    @State private var selectedDay: String?
    @State private var workbench: FeatureWorkbenchRoute?

    var body: some View {
        let zone = Metrics.profileTimeZone(state: store.state)
        let trends = Metrics.trends(state: store.state, range: range, today: Date(), timeZone: zone)
        let selected = trends.days.first { $0.day == selectedDay } ?? trends.days.last
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                FeatureCard {
                    Text(store.text("活动热图、肌群训练量、体重与动作进步", "Activity, muscle volume, body weight and exercise progress"))
                        .font(.footnote).foregroundStyle(FeatureTheme.muted)
                    FeatureAction(title: store.text("查看训练统计", "View training statistics"), symbol: "figure.run", identifier: "trends.workbench") { workbench = .stats }
                }
                coverageCards(trends)
                chartCard(trends, selected: selected)
                allThreeCard(trends)
                if let selected { dayDetailCard(selected) }
                reviewCard(trends)
            }.padding(20)
        }
        .background(FeatureTheme.background)
        .navigationTitle(store.text("趋势", "Trends"))
        .refreshable { await store.refresh() }
        .sheet(item: $workbench) { route in FeatureWorkbenchSheet(store: store, route: route) }
        .onChange(of: range) { _, _ in selectedDay = nil }
        .accessibilityIdentifier("screen.trends")
    }

    // MARK: Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(store.text("进步，从看见节奏开始。", "See the rhythm behind your progress."))
                .font(.title2.weight(.semibold)).foregroundStyle(FeatureTheme.ink)
            Text(store.text("饮食、训练与睡眠放在一起看，空白也有自己的含义。", "View meals, training and sleep together. A gap is meaningful too."))
                .font(.subheadline).foregroundStyle(FeatureTheme.muted)
            if store.isDemo {
                Text(store.text("演示数据：只供查看，不会保存到任何账户。", "Demo data: view only, nothing is saved to an account."))
                    .font(.caption.weight(.semibold)).accessibilityIdentifier("trends.demo")
            }
            Picker(store.text("统计区间", "Period"), selection: $range) {
                Text(rangeTitle(.week)).tag(TrendRange.week)
                Text(rangeTitle(.fortnight)).tag(TrendRange.fortnight)
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("trends.range")
        }
    }

    private func coverageCards(_ trends: TrendsSummary) -> some View {
        VStack(spacing: 12) {
            ForEach(TrendMetric.allCases, id: \.self) { kind in
                FeatureCard {
                    HStack {
                        Text(recordedTitle(kind)).font(.subheadline).foregroundStyle(FeatureTheme.muted)
                        Spacer()
                        Image(systemName: symbol(kind)).foregroundStyle(FeatureTheme.muted).accessibilityHidden(true)
                    }
                    countLine(trends.recordedDays(kind), identifier: "trends.coverage.\(kind.rawValue)")
                }
            }
        }
    }

    private func chartCard(_ trends: TrendsSummary, selected: TrendDay?) -> some View {
        let known = trends.days.contains { $0.value(metric) != nil }
        return FeatureCard {
            Text(store.text("日趋势", "Daily trends")).font(.headline)
            Text(store.text("点击日期查看数值、记录数与来源。缺少记录显示为 —，不会填成 0。", "Select a date to see values, record counts and sources. Missing records show — and are never filled with 0."))
                .font(.footnote).foregroundStyle(FeatureTheme.muted)
            Picker(store.text("日趋势", "Daily trends"), selection: $metric) {
                ForEach(TrendMetric.allCases, id: \.self) { Text(metricTitle($0)).tag($0) }
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("trends.metric")
            if known {
                chart(trends, selected: selected)
                Text("\(dateLabel(trends.days.first?.day)) – \(dateLabel(trends.days.last?.day)) · \(unit(metric)) · — \(store.text("未记录", "Not recorded"))")
                    .font(.caption).foregroundStyle(FeatureTheme.muted)
            } else {
                VStack(spacing: 10) {
                    Image(systemName: "calendar").font(.title2).foregroundStyle(FeatureTheme.muted).accessibilityHidden(true)
                    Text(store.text("这个时间段还没有相关记录。先记录一次，就能在这里看见它。", "There are no related records in this period. Save one record to see it here."))
                        .font(.subheadline).foregroundStyle(FeatureTheme.muted).multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, minHeight: 150)
                .accessibilityIdentifier("trends.chart.empty")
            }
            dayStrip(trends, selected: selected)
            if let selected { selectedPanel(selected) }
        }
    }

    private func chart(_ trends: TrendsSummary, selected: TrendDay?) -> some View {
        let color = metricColor(metric)
        let maximum = trends.chartMaximum(metric)
        let points = trends.segments(metric).enumerated().flatMap { segment, indices in
            indices.map { TrendPoint(segment: segment, index: $0, value: trends.days[$0].value(metric) ?? 0) }
        }
        return Chart {
            ForEach(points, id: \.index) { point in
                LineMark(x: .value("Day", point.index), y: .value("Value", point.value),
                         series: .value("Run", point.segment))
                    .foregroundStyle(color)
                    .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                PointMark(x: .value("Day", point.index), y: .value("Value", point.value))
                    .foregroundStyle(color)
                    .symbolSize(trends.days[point.index].day == selected?.day ? 120 : 40)
            }
            if let selected, let index = trends.days.firstIndex(of: selected) {
                RuleMark(x: .value("Day", index)).foregroundStyle(FeatureTheme.border)
            }
        }
        .chartXScale(domain: 0...(trends.days.count - 1))
        .chartYScale(domain: 0...maximum)
        .chartXAxis(.hidden)
        .chartYAxis {
            AxisMarks(position: .leading, values: [0, maximum / 2, maximum]) { value in
                AxisGridLine()
                AxisValueLabel { Text(FeatureFormat.number(value.as(Double.self), language: store.language, digits: metric == .sleep ? 1 : 0)) }
            }
        }
        .frame(height: 180)
        .accessibilityLabel(store.text("日趋势图，可在下方选择日期查看详情", "Daily trend chart. Select a date below to inspect it."))
        .accessibilityIdentifier("trends.chart")
    }

    /// One button per day, so every day - recorded or not - can be selected, as on the website.
    private func dayStrip(_ trends: TrendsSummary, selected: TrendDay?) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Array(trends.days.enumerated()), id: \.element.day) { index, day in
                    let isSelected = day.day == selected?.day
                    Button { selectedDay = day.day } label: {
                        VStack(spacing: 4) {
                            Text(trends.range == .week || index % 2 == 0 || index == trends.days.count - 1 ? dateLabel(day.day, short: true) : " ")
                                .font(.caption2)
                            Text(day.value(metric) == nil ? "—" : "●")
                                .font(.caption).foregroundStyle(day.value(metric) == nil ? FeatureTheme.muted : metricColor(metric))
                        }
                        .frame(minWidth: 38, minHeight: 44)
                        .background(isSelected ? FeatureTheme.accent.opacity(0.35) : .clear, in: RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(isSelected ? FeatureTheme.ink : FeatureTheme.muted)
                    .accessibilityLabel(describe(day))
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                    .accessibilityIdentifier("trends.day.\(day.day)")
                }
            }
        }
    }

    private func selectedPanel(_ day: TrendDay) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(store.text("所选日期", "Selected date")).font(.caption).foregroundStyle(FeatureTheme.muted)
                    Text(dateLabel(day.day)).font(.headline)
                }
                Spacer()
                Text(display(day.value(metric), metric)).font(.system(size: 24, weight: .semibold, design: .rounded))
                    .accessibilityIdentifier("trends.selected.value")
            }
            HStack(alignment: .top) {
                ForEach(TrendMetric.allCases, id: \.self) { kind in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(metricTitle(kind)).font(.caption).foregroundStyle(FeatureTheme.muted)
                        Text(display(day.value(kind), kind)).font(.subheadline.weight(.semibold))
                            .accessibilityIdentifier("trends.selected.\(kind.rawValue)")
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            Text(store.text("来源", "Source") + ": " + source(day)).font(.caption).foregroundStyle(FeatureTheme.muted)
            if day.value(metric) == nil { Text(missingHelp).font(.caption).foregroundStyle(FeatureTheme.muted) }
        }
        .padding(14)
        .background(FeatureTheme.background, in: RoundedRectangle(cornerRadius: 12))
    }

    private func allThreeCard(_ trends: TrendsSummary) -> some View {
        FeatureCard {
            Text(store.text("记录覆盖", "Record coverage")).font(.headline)
            countLine(trends.daysWithAllThree, identifier: "trends.coverage.all")
            Text(store.text("三类均有记录", "Days with all three categories")).font(.footnote).foregroundStyle(FeatureTheme.muted)
            Text(store.text("指这段时间里有记录的日期，不代表你记录了全部饮食、活动或睡眠，也不是健康分数。", "This counts dates with records. It does not mean all meals, activity or sleep were recorded, and it is not a health score."))
                .font(.footnote).foregroundStyle(FeatureTheme.muted)
        }
    }

    private func dayDetailCard(_ day: TrendDay) -> some View {
        FeatureCard {
            Text(store.text("这一天的记录", "Records for this date")).font(.headline)
            Text(dateLabel(day.day)).font(.subheadline.weight(.semibold))
            Text(recordCounts(day)).font(.subheadline).foregroundStyle(FeatureTheme.muted)
                .accessibilityIdentifier("trends.day.records")
            if !day.mealNames.isEmpty { Text(day.mealNames.joined(separator: " · ")).font(.footnote).foregroundStyle(FeatureTheme.muted) }
            if !day.workoutNames.isEmpty { Text(day.workoutNames.joined(separator: " · ")).font(.footnote).foregroundStyle(FeatureTheme.muted) }
            Text(day.sleepRecords > 0
                 ? store.text("同一天的重叠睡眠区间合并计算，避免重复计时；主观精力与感受分别保留。", "Overlapping sleep intervals for the same day are merged to avoid counting time twice. Energy and how you felt remain separate records.")
                 : missingHelp)
                .font(.footnote).foregroundStyle(FeatureTheme.muted)
        }
    }

    private func reviewCard(_ trends: TrendsSummary) -> some View {
        FeatureCard {
            Text(store.text("把本周变成下一步。", "Turn this week into a next step.")).font(.headline)
            Text(store.text("根据这段时间实际保存的记录整理，没有调用 AI。", "Based on actual records saved for this period. No AI is being called."))
                .font(.footnote).foregroundStyle(FeatureTheme.muted)
            FeatureMetric(title: store.text("已记录日期的平均睡眠", "Average sleep on recorded dates"),
                          value: FeatureFormat.number(trends.averageSleepHours, language: store.language, digits: 1),
                          unit: unit(.sleep), identifier: "trends.review.sleep")
            FeatureMetric(title: store.text("已记录训练总时间", "Total recorded training time"),
                          value: FeatureFormat.number(trends.totalTrainingMinutes, language: store.language, digits: 0),
                          unit: unit(.training), identifier: "trends.review.training")
            FeatureMetric(title: store.text("保存的饮食记录", "Saved food records"),
                          value: FeatureFormat.number(Double(trends.mealRecords), language: store.language, digits: 0),
                          unit: store.text("条", trends.mealRecords == 1 ? "record" : "records"), identifier: "trends.review.meals")
            Text(trends.isComplete
                 ? store.text("下一步：保持记录，并在计划页选择一个适合下周的小调整。", "Next step: keep recording and choose one manageable adjustment for next week on the Plan page.")
                 : store.text("下一步：选择最容易坚持的一项记录。先补足背景，再判断是否需要调整计划。", "Next step: choose one record you can keep up with. Add context before deciding whether to change your plan."))
                .font(.subheadline)
            Text(store.text("这些趋势帮助你发现变化。它们不能证明饮食、训练与睡眠之间的因果关系。", "These trends can help you notice changes. They do not establish cause and effect between food, training and sleep."))
                .font(.footnote).foregroundStyle(FeatureTheme.muted)
        }
    }

    // MARK: Text and formatting

    private var missingHelp: String {
        store.text("未记录不代表没有进食、没有活动或没有睡眠。", "A missing record does not mean you did not eat, move or sleep.")
    }

    private func countLine(_ count: Int, identifier: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(FeatureFormat.number(Double(count), language: store.language, digits: 0))
                .font(.system(size: 30, weight: .semibold, design: .rounded))
            Text(store.text("/ \(range.rawValue) 天", "of \(range.rawValue) days")).font(.subheadline).foregroundStyle(FeatureTheme.muted)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
    }

    private func rangeTitle(_ value: TrendRange) -> String {
        value == .week ? store.text("最近 7 天", "Last 7 days") : store.text("最近 14 天", "Last 14 days")
    }

    private func metricTitle(_ kind: TrendMetric) -> String {
        switch kind {
        case .nutrition: store.text("记录的饮食能量", "Recorded food energy")
        case .training: store.text("训练时间", "Training time")
        case .sleep: store.text("记录的睡眠", "Recorded sleep")
        }
    }

    private func recordedTitle(_ kind: TrendMetric) -> String {
        switch kind {
        case .nutrition: store.text("饮食有记录", "Days with food records")
        case .training: store.text("训练有记录", "Days with training records")
        case .sleep: store.text("睡眠有记录", "Days with sleep records")
        }
    }

    private func symbol(_ kind: TrendMetric) -> String {
        switch kind {
        case .nutrition: "fork.knife"
        case .training: "figure.run"
        case .sleep: "moon"
        }
    }

    private func metricColor(_ kind: TrendMetric) -> Color {
        switch kind {
        case .nutrition: Color(red: 0x70 / 255.0, green: 0x9c / 255.0, blue: 0x37 / 255.0)
        case .training: Color(red: 0x28 / 255.0, green: 0x33 / 255.0, blue: 0x39 / 255.0)
        case .sleep: Color(red: 0x80 / 255.0, green: 0x7b / 255.0, blue: 0xa3 / 255.0)
        }
    }

    private func unit(_ kind: TrendMetric) -> String {
        switch kind {
        case .nutrition: "kcal"
        case .training: store.text("分钟", "min")
        case .sleep: store.text("小时", "hours")
        }
    }

    private func display(_ value: Double?, _ kind: TrendMetric) -> String {
        guard let value else { return "—" }
        return FeatureFormat.number(value, language: store.language, digits: kind == .sleep ? 1 : 0) + " " + unit(kind)
    }

    private func source(_ day: TrendDay) -> String {
        switch metric {
        case .nutrition:
            day.includesEstimate
                ? store.text("包含估算记录；数值应结合份量审核理解", "Includes estimates; review them with the portion sizes in mind")
                : store.text("手动录入与用户审核的标签数值", "Manual entries and label values reviewed by you")
        case .training: store.text("你保存的训练完成记录", "Training completion records you saved")
        case .sleep: store.text("手动睡眠记录，按醒来日归属", "Manual sleep entries, assigned to the wake-up date")
        }
    }

    private func recordCounts(_ day: TrendDay) -> String {
        if store.language == "zh" {
            return "\(day.mealRecords) 条 · \(day.workoutRecords) 次训练 · \(day.sleepRecords) 条睡眠记录"
        }
        return "\(day.mealRecords) \(day.mealRecords == 1 ? "record" : "records") · "
            + "\(day.workoutRecords) \(day.workoutRecords == 1 ? "training session" : "training sessions") · "
            + "\(day.sleepRecords) \(day.sleepRecords == 1 ? "sleep record" : "sleep records")"
    }

    private func describe(_ day: TrendDay) -> String {
        let value = day.value(metric)
        return "\(dateLabel(day.day)): \(metricTitle(metric)) \(display(value, metric))" + (value == nil ? ", " + store.text("未记录", "Not recorded") : "")
    }

    /// Record days are calendar dates, so they are formatted in UTC from noon, as the website does.
    private func dateLabel(_ day: String?, short: Bool = false) -> String {
        guard let day, let date = ISO8601DateFormatter().date(from: day + "T12:00:00Z") else { return "—" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: store.language == "zh" ? "zh_CN" : "en_US")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.setLocalizedDateFormatFromTemplate(short ? "Md" : "MMMdEEE")
        return formatter.string(from: date)
    }
}
