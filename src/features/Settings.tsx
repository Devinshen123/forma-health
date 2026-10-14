import { useState } from "react";
import {
  Download,
  LogOut,
  Trash2,
  ShieldCheck,
  Globe,
  Smartphone,
} from "lucide-react";
import type { FeatureProps, User } from "../types";
import { request } from "../api";
import { Modal } from "../components/Modal";
export default function Settings({
  state,
  lang,
  save,
  notify,
  demo,
  user,
  onLogout,
  onDeleted,
  onCreate,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
  onDeleted: () => void;
  onCreate: () => void;
} & FeatureProps) {
  const zh = lang === "zh";
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function exportData() {
    try {
      const data = demo ? state : await request("/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `forma-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify("导出已完成。", "Export complete.");
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await request("/account", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      setDeleting(false);
      onDeleted();
      notify("账户和本机记录已删除。", "Account and local records deleted.");
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack settings-page">
      <div>
        <h1 className="page-heading">
          {zh ? "始终，由你掌控。" : "Always in your control."}
        </h1>
        <p className="page-subtitle">
          {zh
            ? "账户、偏好和数据，都在这里。"
            : "Your account, preferences and data."}
        </p>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>{zh ? "我的账户" : "My account"}</h2>
          <ShieldCheck size={22} />
        </div>
        <p>
          <strong>{demo ? (zh ? "演示模式" : "Demo mode") : user?.name}</strong>
        </p>
        <p className="muted">
          {demo
            ? zh
              ? "示例改动只用于本次体验。创建账户后开始保存真实记录。"
              : "Demo changes last for this session. Create an account for real records."
            : user?.email}
        </p>
        <button
          className="btn btn-secondary"
          onClick={
            demo ? onCreate : () => onLogout().catch((e) => notify(String(e)))
          }
        >
          {demo ? (
            zh ? (
              "创建我的账户"
            ) : (
              "Create my account"
            )
          ) : (
            <>
              <LogOut size={17} />
              {zh ? "退出账户" : "Sign out"}
            </>
          )}
        </button>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>{zh ? "显示偏好" : "Preferences"}</h2>
          <Globe size={22} />
        </div>
        <label className="field">
          {zh ? "重量单位" : "Weight units"}
          <select
            className="input"
            value={state.profile?.units || "metric"}
            disabled={!state.profile}
            onChange={(e) => {
              if (state.profile)
                save({
                  ...state,
                  profile: {
                    ...state.profile,
                    units: e.target.value as "metric" | "imperial",
                  },
                }).catch((err) => notify(String(err)));
            }}
          >
            <option value="metric">
              {zh ? "公制 · 克 / 公斤" : "Metric · g / kg"}
            </option>
            <option value="imperial">
              {zh ? "英制 · 磅（训练负重）" : "Imperial · lb (training loads)"}
            </option>
          </select>
        </label>
        <p className="hint">
          {zh
            ? "营养记录使用克；训练负重可切换单位。日期按记录时区保存。"
            : "Nutrition uses grams. Training loads can use pounds. Dates retain their recorded timezone."}
        </p>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>{zh ? "连接与数据处理" : "Connections & data use"}</h2>
          <Smartphone size={22} />
        </div>
        <div className="record-row">
          <div className="row-main">
            <strong>Apple Health</strong>
            <p className="muted">
              {zh
                ? "需要 iPhone App 授权连接。网页可查看之后同步的记录。"
                : "Requires permission in the iPhone app. Web will show synced records."}
            </p>
          </div>
          <span className="badge">{zh ? "尚未接入" : "Not connected"}</span>
        </div>
        <div className="record-row">
          <div className="row-main">
            <strong>
              {zh ? "照片识别与报告 OCR" : "Photo analysis & report OCR"}
            </strong>
            <p className="muted">
              {zh
                ? "目前使用手动记录与校正。启用 AI 前将说明处理方与数据用途。"
                : "Manual entry and correction are available. AI data use will be explained before activation."}
            </p>
          </div>
          <span className="badge">{zh ? "尚未接入" : "Not connected"}</span>
        </div>
        <p className="hint">
          {zh
            ? "本机版不向 AI 服务上传健康记录。云同步和 AI 处理将分别征求同意。"
            : "This local version sends no health records to AI services. Cloud sync and AI processing will request separate consent."}
        </p>
      </section>
      <section className="panel">
        <h2 className="section-title">{zh ? "我的数据" : "My data"}</h2>
        <div className="row-actions">
          <button className="btn btn-secondary" onClick={exportData}>
            <Download size={17} />
            {zh ? "导出全部记录" : "Export all records"}
          </button>
          {!demo && (
            <button
              className="btn btn-danger"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={17} />
              {zh ? "删除账户与记录" : "Delete account & records"}
            </button>
          )}
        </div>
        <p className="hint">
          {zh
            ? "删除包含记录、上传文件与登录会话。导出文件包含你的个人数据，请妥善保存。"
            : "Deletion includes records, uploaded files and sessions. Exports contain your personal data; keep them private."}
        </p>
      </section>
      {deleting && (
        <Modal
          title={
            zh ? "删除账户与全部记录？" : "Delete account and all records?"
          }
          description={
            zh
              ? "这会永久删除本机记录及上传文件，无法撤销。"
              : "This permanently removes local records and uploaded files. It cannot be undone."
          }
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setDeleting(false)}
              >
                {zh ? "保留账户" : "Keep account"}
              </button>
              <button
                className="btn btn-danger"
                onClick={remove}
                disabled={!password || busy}
              >
                {busy
                  ? zh
                    ? "正在删除…"
                    : "Deleting…"
                  : zh
                    ? "永久删除"
                    : "Permanently delete"}
              </button>
            </>
          }
        >
          <label className="field">
            {zh ? "输入密码确认" : "Confirm with your password"}
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        </Modal>
      )}
    </div>
  );
}
