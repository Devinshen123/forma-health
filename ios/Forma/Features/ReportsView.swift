import Foundation
import PhotosUI
import SwiftUI
import UIKit
import FormaCore

/// Lab reports. Markers are what the user transcribed from their own document: nothing is read by
/// AI, no value is converted, and a reference range is shown only when they typed one. Uploading a
/// new original is not in this build — see the notice on the page.
@MainActor
struct ReportsView: View {
    /// Two `.sheet` modifiers on one view do not both work, so the page presents one sheet
    /// whose case says which.
    enum Presented: Identifiable {
        case editor(ReportEditorFields)
        case attachment(ReportView)

        var id: String {
            switch self {
            case .editor(let fields): return "editor:" + fields.id
            case .attachment(let report): return "attachment:" + report.id
            }
        }
    }

    let store: AppStore
    @State private var presented: Presented?

    private var reports: [ReportView] { store.reports }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                intro
                if let error = store.reportError {
                    FeatureCard {
                        Text(error).font(.footnote).foregroundStyle(.red)
                            .accessibilityIdentifier("reports.error")
                    }
                }
                if reports.isEmpty {
                    FeatureEmpty(title: store.text("还没有报告", "No reports yet"),
                                 message: store.text("手动填写指标即可记录一份化验单。原件照片目前要在网站上传。",
                                                     "Type your markers to record a lab report. Uploading the original is on the website for now."),
                                 symbol: "doc.text")
                } else {
                    ForEach(reports) { report in
                        card(report)
                    }
                }
            }
            .padding(20)
        }
        .background(FeatureTheme.background)
        .navigationTitle(store.text("报告", "Reports"))
        .refreshable { await store.refresh() }
        .sheet(item: $presented) { item in
            switch item {
            case .editor(let fields): ReportEditorSheet(store: store, fields: fields)
            case .attachment(let report): AttachmentSheet(store: store, report: report)
            }
        }
        .accessibilityIdentifier("screen.reports")
    }

    private var intro: some View {
        FeatureCard {
            RecordNotice(store: store, locked: false)
            Text(store.text("你的化验单", "Your lab reports")).font(.headline)
            Text(store.text("指标由你照抄原件；本应用不读取、不解析、不换算你的报告，也不给出诊断。",
                            "You transcribe the markers yourself. This app does not read, interpret or convert your document, and gives no diagnosis."))
                .font(.caption).foregroundStyle(FeatureTheme.muted)
            Text(store.text("原件可以从照片或文件里添加，和网站一样存在你的账户下；演示模式不会上传。",
                            "Add an original from your photos or files; it is stored under your account just as on the website. The demo never uploads."))
                .font(.caption).foregroundStyle(FeatureTheme.muted)
                .accessibilityIdentifier("reports.upload.notice")
            FeatureAction(title: store.text("新建报告", "New report"),
                          symbol: "plus", identifier: "reports.new") {
                presented = .editor(ReportEditorFields())
            }
            .disabled(store.isBusy)
        }
    }

    private func card(_ report: ReportView) -> some View {
        FeatureCard {
            VStack(alignment: .leading, spacing: 4) {
                Text(report.name).font(.headline)
                    .accessibilityIdentifier("reports.name.\(report.id)")
                Text(report.date).font(.caption).foregroundStyle(FeatureTheme.muted)
                    .accessibilityIdentifier("reports.date.\(report.id)")
            }
            if report.markers.isEmpty {
                Text(store.text("这份报告只有原件，没有手填指标。", "This report holds only its original, with no typed markers."))
                    .font(.subheadline).foregroundStyle(FeatureTheme.muted)
                    .accessibilityIdentifier("reports.markers.empty.\(report.id)")
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(report.markers.enumerated()), id: \.offset) { entry in
                        marker(entry.element)
                    }
                }
            }
            HStack(spacing: 14) {
                Button(store.text("编辑指标", "Edit markers")) {
                    presented = .editor(ReportEditorFields(report: report))
                }
                .disabled(store.isBusy)
                .accessibilityIdentifier("reports.edit.\(report.id)")
                if report.hasAttachment {
                    Button(store.text("查看原件", "View original")) { presented = .attachment(report) }
                        .disabled(store.isBusy)
                        .accessibilityIdentifier("reports.view.\(report.id)")
                }
                Spacer(minLength: 0)
            }
            .font(.subheadline)
            if report.hasAttachment {
                Button(store.text("移除原件附件", "Remove the original")) {
                    Task { await store.removeAttachment(from: report) }
                }
                .font(.subheadline)
                .foregroundStyle(.red)
                .disabled(store.isBusy)
                .accessibilityIdentifier("reports.removeAttachment.\(report.id)")
            }
        }
    }

    private func marker(_ marker: ReportMarker) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(marker.name).font(.subheadline).foregroundStyle(FeatureTheme.ink)
                Spacer(minLength: 0)
                // The value is shown exactly as transcribed; it is text, not a computed number.
                Text(marker.value).font(.subheadline.weight(.semibold))
                if !marker.unit.isEmpty {
                    Text(marker.unit).font(.caption).foregroundStyle(FeatureTheme.muted)
                }
            }
            if !marker.range.isEmpty {
                Text(store.text("参考范围 \(marker.range)", "Reference range \(marker.range)"))
                    .font(.caption2).foregroundStyle(FeatureTheme.muted)
            }
            if !marker.notes.isEmpty {
                Text(marker.notes).font(.caption2).foregroundStyle(FeatureTheme.muted)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// The editable report as text, so a half-typed field is never read as a value.
struct ReportEditorFields: Identifiable {
    struct MarkerDraft: Identifiable {
        let id = UUID()
        var name = ""
        var value = ""
        var unit = ""
        var range = ""
        var notes = ""

        init() {}

        init(_ marker: ReportMarker) {
            name = marker.name
            value = marker.value
            unit = marker.unit
            range = marker.range
            notes = marker.notes
        }

        var marker: ReportMarker {
            ReportMarker(name: name, value: value, unit: unit, range: range, notes: notes)
        }
    }

    let id: String
    /// nil for a report being created here; set when editing one that already exists.
    let existing: ReportView?
    var name: String
    var date: Date
    var markers: [MarkerDraft]
    /// The original this draft would save with. It survives editing, and dropping it here
    /// only unlinks it; the upload itself is removed when the report is saved without it.
    var assetId: String?

    init() {
        id = UUID().uuidString.lowercased()
        existing = nil
        name = ""
        date = Date()
        markers = [MarkerDraft()]
        assetId = nil
    }

    init(report: ReportView) {
        id = report.id
        existing = report
        name = report.name
        date = (try? NativeReports.day(report.date)) ?? Date()
        markers = report.markers.isEmpty ? [MarkerDraft()] : report.markers.map(MarkerDraft.init)
        assetId = report.assetId
    }

    /// The report document this draft would save, or the refusal explaining why it cannot.
    func build() throws -> JSONValue {
        try NativeReports.report(id: id, name: name, date: date, assetId: assetId,
                                 markers: markers.map(\.marker), createdAt: existing?.createdAt)
    }

    var canSave: Bool { (try? build()) != nil }
}

@MainActor
struct ReportEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    let store: AppStore
    @State private var values: ReportEditorFields
    @State private var saving = false
    @State private var photo: PhotosPickerItem?
    @State private var uploading = false
    @State private var choosingFile = false
    @State private var confirmDelete = false

    init(store: AppStore, fields: ReportEditorFields) {
        self.store = store
        _values = State(initialValue: fields)
    }

    var body: some View {
        NavigationStack {
            Form {
                // A refusal belongs where the eye already is. At the foot of a long form it
                // is off screen when the save is refused, which reads as nothing happening.
                if let error = store.reportError {
                    Section {
                        Text(error).font(.footnote).foregroundStyle(.red)
                            .accessibilityIdentifier("reports.editor.error")
                    }
                }
                Section {
                    TextField(store.text("报告名称", "Report name"), text: $values.name)
                        .accessibilityIdentifier("reports.editor.name")
                    DatePicker(store.text("报告日期", "Report date"), selection: $values.date,
                               displayedComponents: .date)
                        .accessibilityIdentifier("reports.editor.date")
                } footer: {
                    Text(store.text("日期用报告本身的日期，不是今天。", "Use the date on the document, not today's date."))
                }
                ForEach(values.markers.indices, id: \.self) { index in
                    Section {
                        TextField(store.text("指标名称", "Marker name"), text: $values.markers[index].name)
                            .accessibilityIdentifier("reports.editor.marker.\(index).name")
                        TextField(store.text("原始数值（照抄，不要换算）", "Original value (as printed, not converted)"),
                                  text: $values.markers[index].value)
                            .accessibilityIdentifier("reports.editor.marker.\(index).value")
                        TextField(store.text("单位（可选）", "Unit (optional)"), text: $values.markers[index].unit)
                            .accessibilityIdentifier("reports.editor.marker.\(index).unit")
                        TextField(store.text("参考范围（可选）", "Reference range (optional)"),
                                  text: $values.markers[index].range)
                            .accessibilityIdentifier("reports.editor.marker.\(index).range")
                        TextField(store.text("备注（可选）", "Notes (optional)"), text: $values.markers[index].notes)
                            .accessibilityIdentifier("reports.editor.marker.\(index).notes")
                    }
                }
                Section {
                    if let assetId = values.assetId {
                        LabeledContent(store.text("原件", "Original")) {
                            Text(assetId.prefix(8)).font(.caption.monospaced())
                                .foregroundStyle(FeatureTheme.muted)
                        }
                        .accessibilityIdentifier("reports.editor.attachment")
                        Button(store.text("移除原件", "Remove original"), role: .destructive) {
                            values.assetId = nil
                        }
                        .disabled(saving || uploading)
                        .accessibilityIdentifier("reports.editor.attachment.remove")
                    } else {
                        PhotosPicker(selection: $photo, matching: .images, photoLibrary: .shared()) {
                            Text(store.text("从照片添加原件", "Add an original from Photos"))
                        }
                        .disabled(saving || uploading || store.isDemo)
                        .accessibilityIdentifier("reports.editor.attachment.photo")
                        Button(store.text("从文件添加原件（含 PDF）", "Add an original from Files (PDF included)")) {
                            choosingFile = true
                        }
                        .disabled(saving || uploading || store.isDemo)
                        .accessibilityIdentifier("reports.editor.attachment.file")
                    }
                    if uploading {
                        ProgressView(store.text("正在上传…", "Uploading…"))
                            .accessibilityIdentifier("reports.editor.attachment.uploading")
                    }
                } header: {
                    Text(store.text("原件", "Original"))
                } footer: {
                    Text(store.isDemo
                         ? store.text("演示模式不会上传原件，也不会保存到真实账户。",
                                      "The demo never uploads an original or saves it to a real account.")
                         : store.text("原件存在你的账户下，最大 10 MB。本应用不读取它的内容。",
                                      "The original is stored under your account, up to 10 MB. This app never reads what is in it."))
                }
                Section {
                    Button(store.text("再加一个指标", "Add another marker")) {
                        values.markers.append(ReportEditorFields.MarkerDraft())
                    }
                    .disabled(values.markers.count >= NativeReports.markerLimit || saving)
                    .accessibilityIdentifier("reports.editor.addMarker")
                } footer: {
                    Text(store.text("留空的指标不会保存。名称和原始数值都必须填写。",
                                    "A blank marker is not saved. A name and the original value are both required."))
                }
                if values.existing != nil {
                    Section {
                        Button(store.text("删除这份报告", "Delete this report"), role: .destructive) { confirmDelete = true }
                            .disabled(saving || uploading || store.isDemo)
                            .accessibilityIdentifier("reports.editor.delete")
                    } footer: {
                        Text(store.text("删除此报告及其手动指标；它的原件如果没有别的记录在用，也会一并删除。",
                                        "Deletes this report and its manual markers; its original goes too unless another record still uses it."))
                    }
                }
            }
            .confirmationDialog(store.text("删除这份报告？", "Delete this report?"), isPresented: $confirmDelete,
                                titleVisibility: .visible) {
                Button(store.text("删除记录", "Delete report"), role: .destructive) { Task { await delete() } }
                Button(store.text("保留", "Keep"), role: .cancel) {}
            } message: {
                Text(values.existing?.name ?? "")
            }
            .navigationTitle(values.existing == nil
                             ? store.text("新建报告", "New report")
                             : store.text("编辑报告", "Edit report"))
            .onChange(of: photo) { item in
                guard let item else { return }
                Task { await attach(item) }
            }
            .fileImporter(isPresented: $choosingFile,
                          allowedContentTypes: [.png, .jpeg, .webP, .gif, .pdf]) { result in
                guard case .success(let url) = result else { return }
                Task { await attach(url) }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(store.text("取消", "Cancel")) { dismiss() }
                        .disabled(saving).accessibilityIdentifier("reports.editor.cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        let document: JSONValue
                        do {
                            document = try values.build()
                        } catch {
                            // A refused document is explained, never swallowed: a save button
                            // that does nothing leaves no way to find out what is wrong.
                            store.reportError = store.reportMessage(error)
                            return
                        }
                        saving = true
                        Task {
                            await store.saveReport(document)
                            saving = false
                            if store.reportError == nil { dismiss() }
                        }
                    } label: {
                        if saving { ProgressView() } else { Text(store.text("保存", "Save")) }
                    }
                    .disabled(!values.canSave || saving)
                    .accessibilityIdentifier("reports.editor.save")
                }
            }
        }
    }

    @MainActor private func delete() async {
        guard let id = values.existing?.id, !saving else { return }
        saving = true
        defer { saving = false }
        do {
            try await store.deleteRecord(collection: "reports", id: id)
            store.reportError = nil
            dismiss()
        } catch {
            store.reportError = store.reportMessage(error)
        }
    }

    /// Uploads a chosen original and links it to this draft. A refusal leaves the draft as it
    /// was: nothing half-attached is ever saved, and the message says which rule was broken.
    @MainActor private func attach(_ item: PhotosPickerItem) async {
        uploading = true
        defer { uploading = false; photo = nil }
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            store.reportError = store.text("读不出这张照片。", "That photo could not be read.")
            return
        }
        if let id = await store.uploadAttachment(data, name: "report-\(values.id).\(suffix(for: data))") {
            values.assetId = id
        }
    }

    @MainActor private func attach(_ url: URL) async {
        uploading = true
        defer { uploading = false }
        let opened = url.startAccessingSecurityScopedResource()
        defer { if opened { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else {
            store.reportError = store.text("读不出这个文件。", "That file could not be read.")
            return
        }
        if let id = await store.uploadAttachment(data, name: url.lastPathComponent) {
            values.assetId = id
        }
    }

    private func suffix(for data: Data) -> String {
        switch Attachment.type(of: data) {
        case "image/png": return "png"
        case "image/webp": return "webp"
        case "image/gif": return "gif"
        case "application/pdf": return "pdf"
        default: return "jpg"
        }
    }
}

/// Shows the stored original. Only an image is rendered here; a PDF is not, and says so rather
/// than appearing blank.
@MainActor
struct AttachmentSheet: View {
    @Environment(\.dismiss) private var dismiss
    let store: AppStore
    let report: ReportView
    @State private var data: Data?
    @State private var loaded = false

    var body: some View {
        NavigationStack {
            Group {
                if let image = data.flatMap(UIImage.init(data:)) {
                    ScrollView([.horizontal, .vertical]) {
                        Image(uiImage: image).resizable().scaledToFit()
                            .accessibilityIdentifier("reports.attachment.image")
                    }
                } else if loaded, data != nil {
                    ContentUnavailableView {
                        Label(store.text("无法在此预览", "Cannot be previewed here"), systemImage: "doc")
                    } description: {
                        Text(store.text("这份原件不是图片（例如 PDF）。请在网站查看或导出。",
                                        "This original is not an image, for example a PDF. View or export it on the website."))
                    }
                    .accessibilityIdentifier("reports.attachment.unsupported")
                } else if loaded {
                    ContentUnavailableView {
                        Label(store.text("找不到原件", "Original not found"), systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(store.reportError ?? store.text("服务上没有这个附件。", "The service has no such attachment."))
                    }
                    .accessibilityIdentifier("reports.attachment.missing")
                } else {
                    ProgressView()
                }
            }
            .navigationTitle(report.name)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(store.text("关闭", "Close")) { dismiss() }
                        .accessibilityIdentifier("reports.attachment.close")
                }
            }
            .task {
                guard let assetId = report.assetId else { loaded = true; return }
                data = await store.attachmentData(assetId)
                loaded = true
            }
        }
    }
}

/// A compact entry point on the today page.
@MainActor
struct ReportsCard: View {
    let store: AppStore

    var body: some View {
        FeatureCard {
            NavigationLink {
                ReportsView(store: store)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "doc.text").font(.title3)
                        .foregroundStyle(FeatureTheme.ink).accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(store.text("报告", "Reports")).font(.headline).foregroundStyle(FeatureTheme.ink)
                        Text(summary).font(.subheadline).foregroundStyle(FeatureTheme.muted)
                            .accessibilityIdentifier("reports.card.summary")
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.footnote)
                        .foregroundStyle(FeatureTheme.muted).accessibilityHidden(true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("reports.card")
        }
    }

    private var summary: String {
        let count = store.reports.count
        if count == 0 { return store.text("还没有化验单", "No lab reports yet") }
        return store.text("\(count) 份化验单", count == 1 ? "1 lab report" : "\(count) lab reports")
    }
}
