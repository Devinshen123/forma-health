import FormaCore
import PhotosUI
import SwiftUI

/// Reading a photo is the service's job and the record is still the person's. The photo leaves
/// the device only after they say so, every estimated number is theirs to correct, and nothing
/// is saved until they confirm they have checked it. A deployment without a model says so
/// rather than being offered a feature it cannot perform.
@MainActor
struct FoodPhotoFlow: View {
    @Environment(\.dismiss) private var dismiss
    let store: AppStore

    private enum Stage: Equatable {
        case checking, unavailable(String?), consent, working, review, refused(String)
    }

    @State private var stage: Stage = .checking
    @State private var photo: PhotosPickerItem?
    @State private var picked: Data?
    @State private var draft: FoodPhotoDraft?
    @State private var items: [ReviewItem] = []
    @State private var date = Date()
    @State private var type = "lunch"
    @State private var checked = false
    @State private var saving = false
    @State private var message: String?

    private struct ReviewItem: Identifiable {
        let id = UUID()
        /// Which item of the draft this came from, kept so the record can point back at it.
        let index: Int
        var name: String
        var grams: String
        var kcal: String
        var protein: String
        var carbs: String
        var fat: String

        var complete: Bool {
            !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && [grams, kcal, protein, carbs, fat].allSatisfy { FeatureFormat.input($0) != nil }
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                switch stage {
                case .checking: ProgressView(store.text("正在询问服务…", "Asking the service…"))
                case .unavailable(let reason): unavailable(reason)
                case .consent: consent
                case .working: ProgressView(store.text("正在读取照片…", "Reading the photo…"))
                case .review: review
                case .refused(let why): refused(why)
                }
            }
            .navigationTitle(store.text("从照片估算", "Estimate from a photo"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(store.text("取消", "Cancel")) { dismiss() }
                        .disabled(saving).accessibilityIdentifier("nutrition.photo.cancel")
                }
            }
            .task { await check() }
            .onChange(of: photo) { item in
                guard let item else { return }
                Task { await load(item) }
            }
        }
        .interactiveDismissDisabled(saving)
        .accessibilityIdentifier("nutrition.photo.flow")
    }

    // MARK: - Stages

    private func unavailable(_ reason: String?) -> some View {
        ContentUnavailableView {
            Label(store.text("这里暂时不能从照片估算", "Estimating from a photo is unavailable"), systemImage: "camera.badge.ellipsis")
        } description: {
            Text(store.isDemo
                 ? store.text("演示模式不会把照片发出去，也不会保存记录。手动填写仍然可用。",
                              "The demo never sends a photo or saves a record. Entering food by hand still works.")
                 : serviceReason(reason))
        }
        .accessibilityIdentifier("nutrition.photo.unavailable")
    }

    /// The service's own word for why, said plainly rather than guessed at.
    private func serviceReason(_ reason: String?) -> String {
        switch reason {
        case "missing_api_key":
            return store.text("这个部署没有配置识别服务。记录仍然可以手动填写。",
                              "This deployment has no reading service configured. Food can still be entered by hand.")
        case "daily_limit", "budget":
            return store.text("今天的识别次数已经用完。明天再试，或手动填写。",
                              "Today's estimates are used up. Try tomorrow, or enter the food by hand.")
        default:
            return store.text("服务没有提供识别功能。记录仍然可以手动填写。",
                              "The service does not offer this. Food can still be entered by hand.")
        }
    }

    private var consent: some View {
        Form {
            Section {
                PhotosPicker(selection: $photo, matching: .images, photoLibrary: .shared()) {
                    Text(picked == nil
                         ? store.text("选择一张照片", "Choose a photo")
                         : store.text("换一张照片", "Choose a different photo"))
                }
                .accessibilityIdentifier("nutrition.photo.pick")
            } header: {
                Text(store.text("照片", "Photo"))
            } footer: {
                Text(store.text("照片会上传到你的账户，并发给服务读取。它读出来的是估算，不是诊断，也不是你的记录——每个数值你都可以改，确认之后才会保存。",
                                "The photo is uploaded to your account and sent to the service to be read. What comes back is an estimate, not a diagnosis and not yet your record: every value is yours to correct, and nothing is saved until you confirm."))
            }
            if let message {
                Section { Text(message).font(.footnote).foregroundStyle(.red)
                    .accessibilityIdentifier("nutrition.photo.error") }
            }
        }
    }

    private func refused(_ why: String) -> some View {
        ContentUnavailableView {
            Label(store.text("这张照片没法用来记录", "This photo cannot become a record"), systemImage: "questionmark.circle")
        } description: {
            Text(why)
        } actions: {
            Button(store.text("换一张", "Choose another")) { picked = nil; message = nil; stage = .consent }
                .accessibilityIdentifier("nutrition.photo.again")
        }
        .accessibilityIdentifier("nutrition.photo.refused")
    }

    private var review: some View {
        Form {
            Section {
                DatePicker(store.text("日期", "Date"), selection: $date, displayedComponents: .date)
                    .accessibilityIdentifier("nutrition.photo.date")
                Picker(store.text("餐次", "Meal"), selection: $type) {
                    Text(store.text("早餐", "Breakfast")).tag("breakfast")
                    Text(store.text("午餐", "Lunch")).tag("lunch")
                    Text(store.text("晚餐", "Dinner")).tag("dinner")
                    Text(store.text("加餐", "Snack")).tag("snack")
                }
                .accessibilityIdentifier("nutrition.photo.type")
            }
            ForEach(Array(items.enumerated()), id: \.element.id) { position, _ in
                Section {
                    TextField(store.text("食物名称", "Food name"), text: $items[position].name)
                        .accessibilityIdentifier("nutrition.photo.item.\(position).name")
                    TextField(store.text("实际份量（克）", "Portion eaten (g)"), text: $items[position].grams)
                        .keyboardType(.decimalPad)
                        .accessibilityIdentifier("nutrition.photo.item.\(position).grams")
                    TextField(store.text("能量（每100克 kcal）", "Energy (kcal per 100 g)"), text: $items[position].kcal)
                        .keyboardType(.decimalPad)
                        .accessibilityIdentifier("nutrition.photo.item.\(position).kcal")
                    TextField(store.text("蛋白质（每100克）", "Protein (g per 100 g)"), text: $items[position].protein)
                        .keyboardType(.decimalPad)
                        .accessibilityIdentifier("nutrition.photo.item.\(position).protein")
                    TextField(store.text("碳水（每100克）", "Carbs (g per 100 g)"), text: $items[position].carbs)
                        .keyboardType(.decimalPad)
                        .accessibilityIdentifier("nutrition.photo.item.\(position).carbs")
                    TextField(store.text("脂肪（每100克）", "Fat (g per 100 g)"), text: $items[position].fat)
                        .keyboardType(.decimalPad)
                        .accessibilityIdentifier("nutrition.photo.item.\(position).fat")
                    Button(store.text("不记录这一项", "Do not record this one"), role: .destructive) {
                        items.remove(at: position)
                    }
                    .disabled(saving)
                    .accessibilityIdentifier("nutrition.photo.item.\(position).drop")
                } header: {
                    Text(store.text("第 \(position + 1) 项", "Item \(position + 1)"))
                }
            }
            if let draft, !draft.warnings.isEmpty {
                Section {
                    ForEach(Array(draft.warnings.enumerated()), id: \.offset) { _, warning in
                        Text(warning).font(.footnote).foregroundStyle(FeatureTheme.muted)
                    }
                } header: {
                    Text(store.text("服务的提醒", "What the service flagged"))
                }
                .accessibilityIdentifier("nutrition.photo.warnings")
            }
            Section {
                Toggle(store.text("我已逐项核对过这些数值", "I have checked every value above"), isOn: $checked)
                    .accessibilityIdentifier("nutrition.photo.checked")
            } footer: {
                Text(store.text("保存后这些记录会标记为“照片估算”，并留下照片的来源，和手动填写的记录区分开。",
                                "Saved records are marked as estimated from a photo and keep the trail back to it, so they are never mistaken for ones entered by hand."))
            }
            if let message {
                Section { Text(message).font(.footnote).foregroundStyle(.red)
                    .accessibilityIdentifier("nutrition.photo.error") }
            }
            Section {
                Button {
                    Task { await save() }
                } label: {
                    if saving { ProgressView() } else { Text(store.text("保存这 \(items.count) 项", "Save \(items.count) records")) }
                }
                .disabled(!canSave || saving)
                .accessibilityIdentifier("nutrition.photo.save")
            }
        }
    }

    private var canSave: Bool {
        !items.isEmpty && checked && items.allSatisfy(\.complete) && !store.isDemo
    }

    // MARK: - Steps

    private func check() async {
        guard !store.isDemo else { stage = .unavailable(nil); return }
        let capabilities = await store.serviceCapabilities()
        guard let photo = capabilities?.foodPhoto, photo.available else {
            stage = .unavailable(capabilities?.foodPhoto?.reason)
            return
        }
        stage = .consent
    }

    private func load(_ item: PhotosPickerItem) async {
        message = nil
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            message = store.text("读不出这张照片。", "That photo could not be read.")
            return
        }
        if let refusal = Attachment.refusal(for: data, photoOnly: true) {
            message = store.attachmentMessage(refusal)
            return
        }
        picked = data
        await analyse(data)
    }

    private func analyse(_ data: Data) async {
        stage = .working
        guard let assetId = await store.uploadAttachment(data, name: "meal-photo.jpg", photoOnly: true) else {
            message = store.reportError ?? store.error
            stage = .consent
            return
        }
        guard let result = await store.analyseFoodPhoto(assetId: assetId) else {
            message = store.error
            stage = .consent
            return
        }
        draft = result
        guard result.isFood, !result.items.isEmpty else {
            stage = .refused(result.warnings.first
                             ?? store.text("服务没有在这张照片里认出食物。",
                                           "The service did not find food in this photo."))
            return
        }
        items = result.items.enumerated().map { index, item in
            ReviewItem(index: index, name: item.name,
                       grams: item.grams.map(number) ?? "",
                       kcal: item.per100g.kcal.map(number) ?? "",
                       protein: item.per100g.protein.map(number) ?? "",
                       carbs: item.per100g.carbs.map(number) ?? "",
                       fat: item.per100g.fat.map(number) ?? "")
        }
        checked = false
        stage = .review
    }

    /// A value the service left unknown stays an empty field, never a zero that reads as fact.
    private func number(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(format: "%.1f", value)
    }

    private func save() async {
        guard canSave, !saving, let draft else { return }
        saving = true; message = nil
        defer { saving = false }
        do {
            for item in items {
                guard let grams = FeatureFormat.input(item.grams), let kcal = FeatureFormat.input(item.kcal),
                      let protein = FeatureFormat.input(item.protein), let carbs = FeatureFormat.input(item.carbs),
                      let fat = FeatureFormat.input(item.fat) else { return }
                let record = try NativeRecords.reviewedEstimate(
                    name: item.name, date: date, grams: grams, kcal: kcal, protein: protein,
                    carbs: carbs, fat: fat, type: type,
                    assetId: draft.assetId, draftId: draft.id, itemIndex: item.index)
                try await store.saveRecord(collection: "meals", value: record)
            }
            dismiss()
        } catch {
            if error is NativeRecordError {
                message = store.text("请核对名称、份量和每100克营养数值。",
                                     "Check the name, portion and nutrition values per 100 g.")
            } else {
                message = store.error ?? store.message(error)
            }
        }
    }
}
