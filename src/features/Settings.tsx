import { useEffect, useRef, useState } from "react";
import {
  Download,
  LogOut,
  Trash2,
  ShieldCheck,
  Globe,
  Smartphone,
  Camera,
  RefreshCw,
} from "lucide-react";
import type { Capabilities, FeatureProps, User } from "../types";
import { getCapabilities, request } from "../api";
import { Modal } from "../components/Modal";
import HealthConnections from './HealthConnections';
import { AccountSecurity } from '../components/AccountSecurity';
export default function Settings({
  state,
  lang,
  save,
  notify,
  demo,
  accountId,
  user,
  onLogout,
  onDeleted,
  onCreate,
  onSessionChanged,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
  onDeleted: () => Promise<void>;
  onCreate: () => void;
  onSessionChanged: (user: User) => Promise<void>;
} & FeatureProps) {
  const zh = lang === "zh";
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [capabilityLoading, setCapabilityLoading] = useState(true);
  const [capabilityError, setCapabilityError] = useState(false);
  const capabilitySequence = useRef(0);
  const mounted = useRef(true);
  const ownerAccount = useRef(accountId ?? "").current;
  const accountHeaders = { "X-Forma-Account": ownerAccount };
  const refreshCapabilities = async () => {
    const sequence = ++capabilitySequence.current;
    setCapabilityLoading(true); setCapabilityError(false);
    try {
      const result = await getCapabilities();
      if (mounted.current && sequence === capabilitySequence.current) setCapabilities(result);
    } catch {
      if (mounted.current && sequence === capabilitySequence.current) {
        setCapabilities(null); setCapabilityError(true);
      }
    } finally {
      if (mounted.current && sequence === capabilitySequence.current) setCapabilityLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void refreshCapabilities();
    return () => { mounted.current = false; capabilitySequence.current++; };
  }, [user?.id, demo]);
  const photoStatus = capabilityLoading ? zh ? "读取状态中…" : "Checking status…"
    : capabilityError ? zh ? "状态暂不可用" : "Status unavailable"
    : capabilities?.foodPhoto.available ? zh ? "识图已配置" : "Photo analysis configured"
    : capabilities?.foodPhoto.reason === "invalid_config" ? zh ? "配置无效" : "Invalid configuration"
    : zh ? "待配置 OpenAI 密钥" : "Waiting for OpenAI key";
  async function exportData() {
    if (!mounted.current) return;
    try {
      const data = demo ? state : await request("/export", { headers: accountHeaders });
      if (!mounted.current) return;
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
      if (mounted.current) notify(e instanceof Error ? e.message : String(e));
    }
  }
  async function remove() {
    if (!mounted.current || busy || demo) return;
    setBusy(true);
    try {
      await request("/account", {
        method: "DELETE",
        headers: accountHeaders,
        body: JSON.stringify({ password }),
      });
      if (!mounted.current) return;
      setDeleting(false);
      await onDeleted();
      notify("账户和本机记录已删除。", "Account and local records deleted.");
    } catch (e) {
      if (mounted.current) notify(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) setBusy(false);
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
      {!demo && accountId && <AccountSecurity key={accountId} lang={lang} accountId={accountId} onSessionChanged={onSessionChanged} />}
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
                }).catch((err) => { if (mounted.current) notify(String(err)); });
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
            <strong>{zh ? "食物照片识别" : "Food photo analysis"}</strong>
            <p className="muted">
              {zh
                ? "处理方为 OpenAI。每次发送前单独同意，识别结果经你逐项校正后才保存。配置存在不代表已验证真实照片效果。"
                : "Processed by OpenAI. Each send requires consent; results are saved only after your review. Configuration does not verify real-photo quality."}
            </p>
          </div>
          <Camera size={20} />
          <span className="badge" role="status">{photoStatus}</span>
        </div>
        <div className="row-actions"><button className="btn btn-ghost" type="button" disabled={capabilityLoading} onClick={() => void refreshCapabilities()}><RefreshCw size={16} />{zh ? "刷新识图状态" : "Refresh photo-analysis status"}</button></div>
        {!capabilityLoading && !capabilities?.foodPhoto.available ? <p className="hint">{capabilityError
          ? zh ? "无法读取配置状态。你仍可使用手动饮食记录，不会在这里请求识别。" : "Could not read the configuration. Manual food logging is still available; this page does not request analysis."
          : capabilities?.foodPhoto.reason === "invalid_config"
            ? zh ? "请联系本机管理员核对配置。现在仍可手动填写。" : "Ask the local administrator to check configuration. Manual entry is still available."
            : zh ? "尚未配置识图服务。你可以先手动记录，密钥由本机管理员在服务端配置。" : "Photo analysis is not configured. Log manually for now; the local administrator configures the key on the server."}</p> : null}
        {demo ? <p className="hint">{zh ? "演示模式不会调用 AI，也不会生成假识别结果。创建账户后再使用照片识别。" : "Demo mode does not call AI or generate simulated results. Create an account before using photo analysis."}</p> : null}
        <div className="record-row">
          <div className="row-main">
            <strong>
              {zh ? "报告 OCR" : "Report OCR"}
            </strong>
            <p className="muted">
              {zh
                ? "尚未接入。报告图片与 PDF 可以私有保存，指标仍需手动填写与校正。"
                : "Not connected. Report images and PDFs can be saved privately; markers are entered and corrected manually."}
            </p>
          </div>
          <span className="badge">{zh ? "尚未接入" : "Not connected"}</span>
        </div>
        <p className="hint">
          {zh
            ? "只有你本次同意的照片副本及输出语言会发送给 OpenAI，其它账户资料和记录不会随请求发送。原图与记录保存在本机实例；供应商的数据保留按其政策执行。"
            : "Only the photo copy and output language you consent to for that request go to OpenAI. Other account details and records are not sent with it. Originals and records remain in this local instance; provider retention follows its policies."}
        </p>
        <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noreferrer">{zh ? "查看 OpenAI 数据政策" : "View OpenAI data policy"}</a>
      </section>
      <HealthConnections key={`${demo ? 'demo' : accountId}`} lang={lang} demo={demo} accountId={accountId} onCreate={onCreate} />
      <section className="panel">
        <h2 className="section-title">{zh ? "我的数据" : "My data"}</h2>
        <div className="row-actions">
          <button className="btn btn-secondary" onClick={exportData}>
            <Download size={17} />
            {zh ? "导出 JSON 记录" : "Export JSON records"}
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
            ? "请先完成同步，导出不包含尚未同步的本机改动。JSON 包含训练工作台原始记录及其已上传媒体；饮食照片、报告图片和 PDF 仍仅含附件引用，请另行保存所需文件。导出包含个人数据，请妥善保存；删除账户会同时删除记录、上传文件与登录会话。"
            : "Finish syncing first; unsynced changes are not included. JSON includes original training-workbench records and their uploaded media. Food photos, report images and PDFs remain attachment references; save those files separately. Keep exports private; account deletion removes records, uploaded files and sessions."}
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
