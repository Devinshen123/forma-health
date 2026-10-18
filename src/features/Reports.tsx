import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ExternalLink,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { assetUrl, request, uploadFile } from "../api";
import { Modal } from "../components/Modal";
import { AttachmentLifecycle } from "./attachmentLifecycle";
import {
  localDate,
  uid,
  type FeatureProps,
  type Marker,
  type Report,
} from "../types";

type MarkerDraft = Marker & { key: string };
type ReportDraft = {
  id: string;
  existing?: boolean;
  name: string;
  date: string;
  assetId?: string;
  markers: MarkerDraft[];
  createdAt: string;
};
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const newMarker = (): MarkerDraft => ({
  key: uid(),
  name: "",
  value: "",
  unit: "",
  range: "",
  notes: "",
});
const hasMarkerContent = (marker: MarkerDraft) =>
  [marker.name, marker.value, marker.unit, marker.range, marker.notes].some(
    (value) => value.trim(),
  );

function AttachmentPreview({
  file,
  name,
  lang,
}: {
  file: File;
  name: string;
  lang: FeatureProps["lang"];
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  if (!url) return null;
  return (
    <div className="stack">
      {file.type === "application/pdf" ? (
        <iframe
          src={url}
          title={name}
          style={{
            width: "100%",
            height: 360,
            border: "1px solid #e9ecf0",
            borderRadius: 12,
          }}
        />
      ) : (
        <img
          src={url}
          alt={name}
          style={{
            maxWidth: "100%",
            maxHeight: 360,
            objectFit: "contain",
            borderRadius: 12,
          }}
        />
      )}
      <a
        className="btn btn-secondary"
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLink size={16} />
        {lang === "zh" ? "打开本地预览" : "Open local preview"}
      </a>
    </div>
  );
}

export default function Reports({
  state,
  lang,
  save,
  notify,
  demo,
  accountId,
}: FeatureProps) {
  const zh = lang === "zh";
  const [date, setDate] = useState("");
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [demoFiles, setDemoFiles] = useState<Record<string, File>>({});
  const [previewing, setPreviewing] = useState<Report | null>(null);
  const [deleting, setDeleting] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const ownerAccount = useRef(accountId ?? "").current;
  const deleteUpload = (id: string) => request("/assets/" + encodeURIComponent(id), {
    method: "DELETE",
    body: "{}",
    headers: { "X-Forma-Account": ownerAccount },
  });
  const uploads = useRef(new AttachmentLifecycle(deleteUpload));
  const rememberUpload = (id: string | null) => {
    uploads.current.stage(id);
    if (mounted.current) setUploadedId(id);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (!demo) void uploads.current.discard().catch(() => {});
    };
  }, []);
  const reports = state.reports
    .filter((report) => !date || report.date === date)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  const discardUpload = async () => {
    if (demo) return true;
    try {
      await uploads.current.discard();
      if (!mounted.current) return false;
      setUploadedId(null);
      return true;
    } catch (cause) {
      if (!mounted.current) return false;
      setError(
        (zh
          ? "未保存的附件清理失败，请重试关闭："
          : "Could not remove the unsaved attachment. Try closing again: ") +
          (cause instanceof Error ? cause.message : ""),
      );
      notify(
        "未保存的附件暂未清理，请重试",
        "The unsaved attachment could not be removed. Please retry.",
      );
      return false;
    }
  };
  const close = async () => {
    if (!mounted.current || busy) return;
    setBusy(true);
    try {
      if ((await discardUpload()) && mounted.current) {
        setDraft(null);
        setFile(null);
        rememberUpload(null);
        setError("");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const open = (report?: Report) => {
    if (!mounted.current || busy) return;
    setError("");
    rememberUpload(null);
    setFile(report ? (demoFiles[report.id] ?? null) : null);
    setDraft(
      report
        ? {
            ...report,
            existing: true,
            markers: report.markers.length
              ? report.markers.map((marker) => ({ ...marker, key: uid() }))
              : [newMarker()],
          }
        : {
            id: uid(),
            createdAt: new Date().toISOString(),
            name: "",
            date: date || localDate(),
            markers: [newMarker()],
          },
    );
  };
  const patch = (change: Partial<ReportDraft>) =>
    setDraft((current) => (current ? { ...current, ...change } : null));
  const patchMarker = (key: string, change: Partial<MarkerDraft>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            markers: current.markers.map((marker) =>
              marker.key === key ? { ...marker, ...change } : marker,
            ),
          }
        : null,
    );
  const chooseFile = async (selected?: File) => {
    if (!mounted.current || busy) return;
    setError("");
    if (!selected) return;
    if (!FILE_TYPES.includes(selected.type) || selected.size > MAX_FILE_BYTES) {
      setError(
        zh
          ? "请选择 5 MB 以内的 PDF、JPEG、PNG 或 WebP 文件。"
          : "Choose a PDF, JPEG, PNG or WebP file up to 5 MB.",
      );
      return;
    }
    setBusy(true);
    try {
      if ((await discardUpload()) && mounted.current) {
        setFile(selected);
        rememberUpload(null);
        setDraft((current) =>
          current
            ? {
                ...current,
                name:
                  current.name ||
                  selected.name.replace(/\.[^.]+$/, "").slice(0, 160),
              }
            : null,
        );
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const removeAttachment = async () => {
    if (!mounted.current || busy) return;
    setBusy(true);
    try {
      if ((await discardUpload()) && mounted.current) {
        setFile(null);
        rememberUpload(null);
        patch({ assetId: undefined });
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mounted.current || !draft || busy) return;
    setError("");
    const filledMarkers = draft.markers.filter(hasMarkerContent);
    if (
      !draft.name.trim() ||
      !draft.date ||
      filledMarkers.some(
        (marker) => !marker.name.trim() || !marker.value.trim(),
      )
    ) {
      setError(
        zh
          ? "请填写报告名称和日期；每个指标都须包含名称与原始数值。"
          : "Enter the report name and date. Each marker needs a name and the original value.",
      );
      return;
    }
    if (!draft.assetId && !file && !filledMarkers.length) {
      setError(
        zh
          ? "请添加原始附件，或至少填写一个手动指标。"
          : "Add an original attachment or at least one manual marker.",
      );
      return;
    }
    if (demo && !draft.assetId && !filledMarkers.length) {
      setError(
        zh
          ? "演示附件仅供本地预览。请添加至少一个手动指标，再保存演示记录。"
          : "Demo attachments are local previews only. Add at least one manual marker to save a demo record.",
      );
      return;
    }
    setBusy(true);
    try {
      let attachment = uploadedId ?? draft.assetId;
      if (file && !demo && !uploadedId) {
        const result = await uploadFile(file, undefined, ownerAccount);
        attachment = result.id;
        rememberUpload(result.id);
        if (!mounted.current) {
          await uploads.current.discard().catch(() => {});
          return;
        }
      }
      const report: Report = {
        id: draft.id,
        name: draft.name.trim(),
        date: draft.date,
        ...(attachment ? { assetId: attachment } : {}),
        markers: filledMarkers.map(({ name, value, unit, range, notes }) => ({
          name: name.trim(),
          value: value.trim(),
          unit,
          range,
          notes,
        })),
        extractionStatus: "manual",
        createdAt: draft.createdAt,
      };
      uploads.current.retainForSave(attachment);
      await save({
        ...state,
        reports: state.reports.some((item) => item.id === report.id)
          ? state.reports.map((item) => (item.id === report.id ? report : item))
          : [...state.reports, report],
      });
      if (!mounted.current) return;
      if (demo)
        setDemoFiles((current) => {
          const next = { ...current };
          if (file) next[report.id] = file;
          else delete next[report.id];
          return next;
        });
      setDraft(null);
      setFile(null);
      rememberUpload(null);
      notify(
        demo && file ? "演示报告已保存，附件仅在本页预览" : "报告已保存",
        demo && file
          ? "Demo report saved. Its attachment stays in this page only."
          : "Report saved",
      );
    } catch (cause) {
      if (!mounted.current) return;
      setError(
        (zh ? "保存暂未确认：" : "Save not confirmed: ") +
          (cause instanceof Error
            ? cause.message
            : zh
              ? "请重试。"
              : "Please try again."),
      );
      notify(
        "报告保存暂未确认，请查看同步状态后重试",
        "Report save is not confirmed. Check the sync status before retrying.",
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const remove = async () => {
    if (!mounted.current || !deleting || busy) return;
    setBusy(true);
    setError("");
    try {
      await save({
        ...state,
        reports: state.reports.filter((report) => report.id !== deleting.id),
      });
      if (!mounted.current) return;
      setDemoFiles((current) => {
        const next = { ...current };
        delete next[deleting.id];
        return next;
      });
      setDeleting(null);
      notify("报告记录已删除", "Report deleted");
    } catch (cause) {
      if (!mounted.current) return;
      setError(
        (zh ? "删除失败：" : "Could not delete: ") +
          (cause instanceof Error
            ? cause.message
            : zh
              ? "请重试。"
              : "Please try again."),
      );
      notify("未能删除报告", "Could not delete report");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>{zh ? "健康报告" : "Health reports"}</h1>
          <p className="page-subtitle">
            {zh
              ? "保留原始报告，逐项核对你的指标。"
              : "Keep the original report and review your markers."}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => open()}>
          <Plus size={18} />
          {zh ? "添加报告" : "Add report"}
        </button>
      </div>
      <div className="panel">
        <div className="section-title">
          <h2>{zh ? "报告记录" : "Report history"}</h2>
          <div className="row-actions">
            <label className="field">
              <span className="muted">{zh ? "报告日期" : "Report date"}</span>
              <input
                className="input"
                type="date"
                value={date}
                onInput={(event) => setDate(event.currentTarget.value)}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            {date ? (
              <button className="btn btn-ghost" onClick={() => setDate("")}>
                {zh ? "全部日期" : "All dates"}
              </button>
            ) : null}
          </div>
        </div>
        <p className="hint">
          {zh
            ? "OCR 尚未接入。指标为手动录入，参考范围保留报告原文。"
            : "OCR is not connected. Markers are entered manually; reference ranges retain the report’s wording."}
        </p>
        {reports.length ? (
          reports.map((report) => (
            <div
              key={report.id}
              className="stack"
              style={{
                paddingTop: 18,
                paddingBottom: 18,
                borderTop: "1px solid #e9ecf0",
              }}
            >
              <div className="record-row">
                <FileText size={24} />
                <div className="row-main">
                  <strong>{report.name}</strong>
                  <p className="muted">
                    {report.date} · {report.markers.length}{" "}
                    {zh ? "个手动指标" : "manual markers"}
                  </p>
                </div>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={(zh ? "编辑 " : "Edit ") + report.name}
                    onClick={() => open(report)}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={(zh ? "删除 " : "Delete ") + report.name}
                    onClick={() => {
                      setDeleting(report);
                      setError("");
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
              {report.markers.length ? (
                <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr>
                        <th scope="col">{zh ? "指标" : "Marker"}</th>
                        <th scope="col">
                          {zh ? "原始数值" : "Original value"}
                        </th>
                        <th scope="col">{zh ? "单位" : "Unit"}</th>
                        <th scope="col">
                          {zh ? "参考范围原文" : "Original reference range"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.markers.map((marker, index) => (
                        <tr key={index}>
                          <th
                            scope="row"
                            style={{
                              padding: "12px 12px 12px 0",
                              fontWeight: 500,
                            }}
                          >
                            <span>{marker.name}</span>
                            {marker.notes ? (
                              <p
                                className="muted"
                                style={{
                                  whiteSpace: "pre-wrap",
                                  fontWeight: 400,
                                }}
                              >
                                {marker.notes}
                              </p>
                            ) : null}
                          </th>
                          <td style={{ paddingRight: 12 }}>{marker.value}</td>
                          <td style={{ paddingRight: 12 }}>
                            {marker.unit || "—"}
                          </td>
                          <td style={{ whiteSpace: "pre-wrap" }}>
                            {marker.range || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">
                  {zh
                    ? "原始附件已保存，尚未手动填写指标。"
                    : "The original attachment is saved. No manual markers yet."}
                </p>
              )}
              <div className="row-actions">
                <span className="badge">
                  {zh ? "手动核对" : "Manual review"}
                </span>
                {report.assetId ? (
                  <a
                    className="btn btn-ghost"
                    href={assetUrl(report.assetId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Paperclip size={16} />
                    {zh ? "打开原始附件" : "Open original attachment"}
                  </a>
                ) : null}
                {demoFiles[report.id] ? (
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPreviewing(report)}
                  >
                    <Paperclip size={16} />
                    {zh ? "本页演示预览" : "Local demo preview"}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <FileText size={32} />
            <h3>
              {zh ? "报告与指标，从原文开始" : "Start with the original report"}
            </h3>
            <p>
              {zh
                ? "上传报告图片或 PDF，也可以只手动填写指标。"
                : "Upload a report image or PDF, or enter markers manually."}
            </p>
            <button className="btn btn-secondary" onClick={() => open()}>
              {zh ? "添加第一份报告" : "Add your first report"}
            </button>
          </div>
        )}
      </div>
      {draft ? (
        <Modal
          title={
            draft.existing
              ? zh
                ? "校正报告与指标"
                : "Correct report and markers"
              : zh
                ? "添加健康报告"
                : "Add health report"
          }
          description={
            zh
              ? "按照原始报告填写，数值与参考范围可以保留文字和符号。"
              : "Follow the original report. Values and ranges may include text and symbols."
          }
          onClose={close}
          footer={
            <>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={close}
              >
                {zh ? "取消" : "Cancel"}
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                form="report-form"
                disabled={busy}
              >
                {busy
                  ? zh
                    ? "保存中…"
                    : "Saving…"
                  : zh
                    ? "核对并保存"
                    : "Review and save"}
              </button>
            </>
          }
        >
          <form id="report-form" className="stack" onSubmit={submit}>
            <fieldset
              disabled={busy}
              style={{ border: 0, padding: 0, margin: 0 }}
              className="stack"
            >
              <label className="field">
                {zh ? "报告名称" : "Report name"}
                <input
                  className="input"
                  required
                  maxLength={160}
                  value={draft.name}
                  onChange={(event) => patch({ name: event.target.value })}
                />
              </label>
              <label className="field">
                {zh ? "报告日期" : "Report date"}
                <input
                  className="input"
                  type="date"
                  required
                  value={draft.date}
                  onInput={(event) =>
                    patch({ date: event.currentTarget.value })
                  }
                  onChange={(event) => patch({ date: event.target.value })}
                />
              </label>
              <label className="field">
                <span>
                  <Paperclip size={17} />{" "}
                  {zh
                    ? "原始报告图片或 PDF（可选）"
                    : "Original report image or PDF (optional)"}
                </span>
                <input
                  className="input"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    chooseFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              <p className="hint">
                {demo
                  ? zh
                    ? "演示文件仅在本页本地预览，离开后不保留；不会上传。要保存演示报告，请至少填写一个指标。"
                    : "Demo files are local previews for this page and are never uploaded. Enter at least one marker to save a demo report."
                  : zh
                    ? "附件保存到当前账户的私有存储。PDF、JPEG、PNG 或 WebP，单个文件最多 5 MB。"
                    : "Attachments are saved to private account storage. PDF, JPEG, PNG or WebP, up to 5 MB."}
              </p>
              {file ? (
                <div className="stack">
                  <div className="section-title">
                    <span>{file.name}</span>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={removeAttachment}
                    >
                      {zh ? "移除附件" : "Remove attachment"}
                    </button>
                  </div>
                  <AttachmentPreview
                    file={file}
                    name={draft.name || file.name}
                    lang={lang}
                  />
                </div>
              ) : draft.assetId ? (
                <div className="record-row">
                  <a
                    className="btn btn-secondary"
                    href={assetUrl(draft.assetId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={16} />
                    {zh ? "打开已保存的原始附件" : "Open saved original"}
                  </a>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => patch({ assetId: undefined })}
                  >
                    {zh ? "移除附件" : "Remove attachment"}
                  </button>
                </div>
              ) : null}
              <div className="section-title">
                <h3>{zh ? "手动录入指标" : "Manual markers"}</h3>
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={draft.markers.length >= 200}
                  onClick={() =>
                    patch({ markers: [...draft.markers, newMarker()] })
                  }
                >
                  <Plus size={16} />
                  {zh ? "添加指标" : "Add marker"}
                </button>
              </div>
              <p className="hint">
                {zh
                  ? "OCR 尚未接入。这里保留你录入的原始数值和参考范围，不生成诊断。"
                  : "OCR is not connected. This stores the values and ranges you enter; it does not generate a diagnosis."}
              </p>
              {draft.markers.map((marker, index) => (
                <div className="panel stack" key={marker.key}>
                  <div className="section-title">
                    <strong>
                      {zh ? "指标 " : "Marker "}
                      {index + 1}
                    </strong>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={zh ? "移除此指标" : "Remove marker"}
                      onClick={() =>
                        patch({
                          markers: draft.markers.filter(
                            (item) => item.key !== marker.key,
                          ),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      {zh ? "指标名称" : "Marker name"}
                      <input
                        className="input"
                        maxLength={160}
                        required={!!hasMarkerContent(marker)}
                        value={marker.name}
                        onChange={(event) =>
                          patchMarker(marker.key, { name: event.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      {zh
                        ? "原始数值（可含 >、< 等符号）"
                        : "Original value (including > or <)"}
                      <input
                        className="input"
                        maxLength={500}
                        required={!!hasMarkerContent(marker)}
                        value={marker.value}
                        onChange={(event) =>
                          patchMarker(marker.key, { value: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      {zh ? "单位（原文）" : "Unit (original)"}
                      <input
                        className="input"
                        maxLength={100}
                        value={marker.unit}
                        onChange={(event) =>
                          patchMarker(marker.key, { unit: event.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      {zh
                        ? "参考范围（保留原文）"
                        : "Reference range (keep original)"}
                      <textarea
                        className="input"
                        rows={2}
                        maxLength={500}
                        value={marker.range}
                        onChange={(event) =>
                          patchMarker(marker.key, { range: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="field">
                    {zh ? "备注（可选）" : "Notes (optional)"}
                    <textarea
                      className="input"
                      rows={2}
                      maxLength={2000}
                      value={marker.notes}
                      onChange={(event) =>
                        patchMarker(marker.key, { notes: event.target.value })
                      }
                    />
                  </label>
                </div>
              ))}
            </fieldset>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </Modal>
      ) : null}
      {previewing && demoFiles[previewing.id] ? (
        <Modal
          title={previewing.name}
          description={
            zh
              ? "仅本页本地预览，文件未上传。"
              : "Local preview for this page. The file has not been uploaded."
          }
          onClose={() => setPreviewing(null)}
        >
          <AttachmentPreview
            file={demoFiles[previewing.id]}
            name={previewing.name}
            lang={lang}
          />
        </Modal>
      ) : null}
      {deleting ? (
        <Modal
          title={zh ? "删除这份报告？" : "Delete this report?"}
          description={deleting.name}
          onClose={() => {
            if (!busy) {
              setDeleting(null);
              setError("");
            }
          }}
          footer={
            <>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => {
                  setDeleting(null);
                  setError("");
                }}
              >
                {zh ? "保留" : "Keep"}
              </button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={remove}
              >
                {busy
                  ? zh
                    ? "删除中…"
                    : "Deleting…"
                  : zh
                    ? "删除记录"
                    : "Delete report"}
              </button>
            </>
          }
        >
          <p>
            {zh
              ? "删除此报告及其手动指标。"
              : "Delete this report and its manual markers."}
          </p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
