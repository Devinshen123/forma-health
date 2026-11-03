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

    /// The service's own word for why - `not_configured` or `invalid_config`, the only two it
    /// gives - in the website's words. Anything else means the status could not be read at all.
    private func serviceReason(_ reason: String?) -> String {
        FoodPhotoStatus.explanation(reason, store: store)
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
                VStack(alignment: .leading, spacing: 6) {
                    Text(store.text("选择照片即表示同意本次发送：照片上传到你的账户，处理方为 OpenAI。只有这张照片的副本和输出语言会发给 OpenAI，其他账户资料和记录不会随请求发送；供应商的数据保留按其政策执行。",
                                    "Choosing a photo consents to this one send: it is uploaded to your account and processed by OpenAI. Only this photo's copy and the output language go to OpenAI; other account details and records are not sent with it. Provider retention follows its policies."))
                    Text(store.text("读出来的是估算，不是诊断，也不是你的记录——每个数值你都可以改，确认之后才会保存。",
                                    "What comes back is an estimate, not a diagnosis and not yet your record: every value is yours to correct, and nothing is saved until you confirm."))
                    Link(store.text("查看 OpenAI 数据政策", "View OpenAI data policy"), destination: FoodPhotoStatus.policy)
                        .accessibilityIdentifier("nutrition.photo.policy")
                }
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

/// The website's wording for the photo-reading status, shared by the estimate flow and Settings
/// so the two never describe the same deployment differently.
@MainActor
enum FoodPhotoStatus {
    static let policy = URL(string: "https://developers.openai.com/api/docs/guides/your-data")!

    /// The short badge: configured, invalid, waiting for a key, or unreadable.
    static func badge(_ capabilities: ServiceCapabilities?, failed: Bool, store: AppStore) -> String {
        if failed { return store.text("状态暂不可用", "Status unavailable") }
        if capabilities?.foodPhoto?.available == true { return store.text("识图已配置", "Photo analysis configured") }
        if capabilities?.foodPhoto?.reason == "invalid_config" { return store.text("配置无效", "Invalid configuration") }
        return store.text("待配置 OpenAI 密钥", "Waiting for OpenAI key")
    }

    /// Why it cannot be used, and that manual entry still works.
    static func explanation(_ reason: String?, store: AppStore) -> String {
        switch reason {
        case "invalid_config":
            return store.text("请联系本机管理员核对配置。现在仍可手动填写。",
                              "Ask the local administrator to check configuration. Manual entry is still available.")
        case "not_configured":
            return store.text("尚未配置识图服务。你可以先手动记录，密钥由本机管理员在服务端配置。",
                              "Photo analysis is not configured. Log manually for now; the local administrator configures the key on the server.")
        default:
            return store.text("无法读取配置状态。你仍可使用手动饮食记录，不会在这里请求识别。",
                              "Could not read the configuration. Manual food logging is still available; this page does not request analysis.")
        }
    }
}
