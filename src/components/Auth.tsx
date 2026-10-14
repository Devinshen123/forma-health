import { useState, type FormEvent } from "react";
import { ArrowRight, Mail, LockKeyhole } from "lucide-react";
import { Modal } from "./Modal";
import * as api from "../api";
import type { Language, User } from "../types";
export function Auth({
  lang,
  onClose,
  onAuthenticated,
}: {
  lang: Language;
  onClose: () => void;
  onAuthenticated: (user: User) => Promise<void>;
}) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const zh = lang === "zh";
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const { user } =
        mode === "register"
          ? await api.register(email, password, name)
          : await api.login(email, password);
      await onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title={zh ? "让下一步，属于你。" : "Make the next step yours."}
      description={
        zh
          ? "创建本机账户，开始记录你的真实进展。"
          : "Create a local account to track your real progress."
      }
      onClose={onClose}
    >
      <div className="segmented">
        <button
          onClick={() => {
            setMode("register");
            setError("");
          }}
          className={mode === "register" ? "selected" : ""}
        >
          {zh ? "创建账户" : "Create account"}
        </button>
        <button
          onClick={() => {
            setMode("login");
            setError("");
          }}
          className={mode === "login" ? "selected" : ""}
        >
          {zh ? "登录" : "Sign in"}
        </button>
      </div>
      <form onSubmit={submit} className="stack auth-form">
        {mode === "register" && (
          <label className="field">
            {zh ? "怎么称呼你" : "Your name"}
            <input
              className="input"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
            />
          </label>
        )}
        <label className="field">
          <span>
            <Mail size={15} /> {zh ? "邮箱" : "Email"}
          </span>
          <input
            className="input"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span>
            <LockKeyhole size={15} />{" "}
            {zh ? "密码（至少 10 位）" : "Password (10+ characters)"}
          </span>
          <input
            className="input"
            required
            type="password"
            minLength={10}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary full-width" disabled={pending}>
          {pending
            ? zh
              ? "正在处理…"
              : "Working…"
            : mode === "register"
              ? zh
                ? "创建账户并制定计划"
                : "Create account & plan"
              : zh
                ? "登录我的账户"
                : "Sign in"}
          <ArrowRight size={18} />
        </button>
        <p className="hint">
          {zh
            ? "本机测试账户只保存在这台电脑，不发送验证邮件。Apple 登录将随云端账户接入。"
            : "Local test accounts stay on this computer. No verification email is sent. Apple sign-in will arrive with cloud accounts."}
        </p>
      </form>
    </Modal>
  );
}
