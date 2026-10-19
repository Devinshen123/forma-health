import SwiftUI
import FormaCore

@MainActor
struct NutritionView: View {
    let store: AppStore
    @State private var showingEditor = false

    private var summary: DayMetrics { Metrics.dailySummary(state: store.state, date: Date()) }
    private var meals: [FeatureRecord] { FeatureFormat.rows(FeatureFormat.latest(store.records("meals"))) }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                FeatureAction(title: store.text("记录饮食", "Record food"), symbol: "plus", identifier: "nutrition.add") { showingEditor = true }
                FeatureCard {
                    Text(store.text("今日已记录", "Recorded today")).font(.headline)
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 20) {
                        FeatureMetric(title: store.text("能量", "Energy"), value: FeatureFormat.number(summary.nutrition?.kcal, language: store.language), unit: "kcal", identifier: "nutrition.total.kcal")
                        FeatureMetric(title: store.text("蛋白质", "Protein"), value: FeatureFormat.number(summary.nutrition?.protein, language: store.language), unit: "g", identifier: "nutrition.total.protein")
                        FeatureMetric(title: store.text("碳水", "Carbs"), value: FeatureFormat.number(summary.nutrition?.carbs, language: store.language), unit: "g", identifier: "nutrition.total.carbs")
                        FeatureMetric(title: store.text("脂肪", "Fat"), value: FeatureFormat.number(summary.nutrition?.fat, language: store.language), unit: "g", identifier: "nutrition.total.fat")
                    }
                    Text(store.text("仅合计已保存的饮食；缺少记录不等于没有进食。", "Totals include saved food only; missing records do not mean no food was eaten."))
                        .font(.footnote).foregroundStyle(FeatureTheme.muted)
                }
                Text(store.text("饮食历史", "Food history")).font(.title3.weight(.semibold))
                if meals.isEmpty {
                    FeatureEmpty(title: store.text("还没有饮食记录", "No food records yet"), message: store.text("手动填写食物、份量和每100克营养，核对后再保存。", "Enter the food, portion and nutrition per 100 g, then review before saving."), symbol: "fork.knife")
                }
                ForEach(meals) { row in MealHistoryCard(record: row.value, language: store.language) }
            }.padding(20)
        }
        .background(FeatureTheme.background)
        .navigationTitle(store.text("饮食", "Nutrition"))
        .refreshable { await store.refresh() }
        .sheet(isPresented: $showingEditor) { MealEditor(store: store) }
        .accessibilityIdentifier("screen.nutrition")
    }
}

@MainActor
private struct MealHistoryCard: View {
    let record: JSONValue
    let language: String

    var body: some View {
        FeatureCard {
            Text(record["name"].stringValue ?? "—").font(.headline)
            Text((record["date"].stringValue ?? "—") + " · " + FeatureFormat.number(record["grams"].doubleValue, language: language) + " g")
                .font(.subheadline).foregroundStyle(FeatureTheme.muted)
            Text(FeatureFormat.number(Metrics.mealTotals(record)?.kcal, language: language) + " kcal")
                .font(.title3.weight(.semibold))
        }
    }
}

@MainActor
private struct MealEditor: View {
    @Environment(\.dismiss) private var dismiss
    let store: AppStore
    @State private var boundAccount: String?
    @State private var name = ""
    @State private var date = Date()
    @State private var type = "lunch"
    @State private var grams = ""
    @State private var kcal = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var saving = false
    @State private var message: String?
    @State private var cachedRecord: JSONValue?

    init(store: AppStore) {
        self.store = store
        _boundAccount = State(initialValue: store.user?.id)
    }

    private var canSave: Bool {
        !store.isDemo && !store.isBusy && boundAccount != nil && boundAccount == store.user?.id &&
        (cachedRecord != nil || (!name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && preview != nil))
    }

    private var preview: NutritionTotals? {
        guard let g = FeatureFormat.input(grams), let k = FeatureFormat.input(kcal),
              let p = FeatureFormat.input(protein), let c = FeatureFormat.input(carbs), let f = FeatureFormat.input(fat) else { return nil }
        return Metrics.mealTotals(.object(["grams": .number(g), "referenceGrams": .number(100), "kcal": .number(k), "protein": .number(p), "carbs": .number(c), "fat": .number(f)]))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section { RecordNotice(store: store, locked: cachedRecord != nil) }
                Section(store.text("食物与份量", "Food and portion")) {
                    TextField(store.text("食物名称", "Food name"), text: $name).accessibilityIdentifier("record.name")
                    DatePicker(store.text("日期", "Date"), selection: $date, displayedComponents: .date)
                    Picker(store.text("餐次", "Meal"), selection: $type) {
                        Text(store.text("早餐", "Breakfast")).tag("breakfast")
                        Text(store.text("午餐", "Lunch")).tag("lunch")
                        Text(store.text("晚餐", "Dinner")).tag("dinner")
                        Text(store.text("加餐", "Snack")).tag("snack")
                    }
                    TextField(store.text("实际份量（克）", "Portion eaten (g)"), text: $grams).keyboardType(.decimalPad).accessibilityIdentifier("record.grams")
                }.disabled(saving || cachedRecord != nil)
                Section(store.text("每100克营养", "Nutrition per 100 g")) {
                    TextField(store.text("能量（kcal）", "Energy (kcal)"), text: $kcal).keyboardType(.decimalPad).accessibilityIdentifier("record.kcal")
                    TextField(store.text("蛋白质（克）", "Protein (g)"), text: $protein).keyboardType(.decimalPad).accessibilityIdentifier("record.protein")
                    TextField(store.text("碳水（克）", "Carbs (g)"), text: $carbs).keyboardType(.decimalPad).accessibilityIdentifier("record.carbs")
                    TextField(store.text("脂肪（克）", "Fat (g)"), text: $fat).keyboardType(.decimalPad).accessibilityIdentifier("record.fat")
                }.disabled(saving || cachedRecord != nil)
                Section(store.text("保存前核对", "Review before saving")) {
                    LabeledContent(store.text("本次能量", "Portion energy"), value: FeatureFormat.number(preview?.kcal, language: store.language) + " kcal")
                    Text(store.text("按实际份量换算；营养未知时请先核对，明确为0才填写0。", "Values are scaled to the portion. Check unknown nutrients first; enter 0 only when it is known."))
                        .font(.footnote).foregroundStyle(FeatureTheme.muted)
                }
                if let message { Section { Text(message).foregroundStyle(.red).accessibilityIdentifier("record.error") } }
            }
            .scrollContentBackground(.hidden).background(FeatureTheme.background)
            .navigationTitle(store.text("记录饮食", "Record food"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { RecordToolbar(store: store, canSave: canSave, saving: saving, retry: cachedRecord != nil, save: beginSave, cancel: { dismiss() }) }
        }
        .interactiveDismissDisabled(saving)
        .accessibilityIdentifier(store.isDemo ? "demo.form" : "record.form")
    }

    private func beginSave() { Task { await save() } }

    private func save() async {
        guard canSave, !saving else { return }
        saving = true; message = nil
        defer { saving = false }
        do {
            let record: JSONValue
            if let cachedRecord { record = cachedRecord }
            else {
                guard let g = FeatureFormat.input(grams), let k = FeatureFormat.input(kcal), let p = FeatureFormat.input(protein), let c = FeatureFormat.input(carbs), let f = FeatureFormat.input(fat) else { return }
                record = try NativeRecords.meal(name: name, date: date, grams: g, kcal: k, protein: p, carbs: c, fat: f, type: type)
                cachedRecord = record
            }
            try await store.saveRecord(collection: "meals", value: record)
            if boundAccount == store.user?.id { dismiss() }
        } catch {
            if error is NativeRecordError {
                message = store.text("请核对名称、份量和每100克营养数值。", "Check the name, portion and nutrition values per 100 g.")
            } else {
                message = store.error ?? store.message(error)
            }
        }
    }
}
