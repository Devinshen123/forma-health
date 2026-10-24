import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, RefreshCw } from 'lucide-react';
import { Modal } from './Modal';
import * as api from '../api';
import type { AuthEntry, AuthOptions, SignInProvider } from '../auth';
import type { Language, User } from '../types';
import '../auth.css';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify' | 'oauth';

/** Only static user-facing errors are shown; responses never expose tokens or credentials. */
export function authErrorMessage(cause: unknown, zh: boolean): string {
  const code = typeof cause === 'string' ? cause : cause instanceof api.ApiError ? cause.code : undefined;
  const messages: Record<string, [string, string]> = {
    AUTH_MAIL_NOT_CONFIGURED: ['邮件发送尚未配置，暂时无法发送验证或重置邮件。你仍可使用密码登录。', 'Email delivery is not configured. Verification and reset emails are unavailable; password sign-in remains available.'],
    AUTH_MAIL_UNAVAILABLE: ['邮件暂时无法发送，请稍后重试。', 'Email could not be sent. Please try again later.'],
    AUTH_MAIL_FAILED: ['邮件暂时无法发送，请稍后重试。', 'Email could not be sent. Please try again later.'],
    AUTH_INVALID_TOKEN: ['此链接无效、已使用或已过期，请重新申请邮件。', 'This link is invalid, used or expired. Request a new email.'],
    AUTH_TOKEN_EXPIRED: ['此链接已过期，请重新申请邮件。', 'This link has expired. Request a new email.'],
    AUTH_RATE_LIMIT: ['操作过于频繁，请稍后再试。', 'Too many attempts. Please try again later.'],
    AUTH_PASSWORD_REQUIRED: ['请先设置密码，或输入当前账户密码确认此操作。', 'Set a password first, or confirm this action with your current account password.'],
    AUTH_CURRENT_PASSWORD_REQUIRED: ['请输入当前账户密码以确认。', 'Enter your current account password to confirm.'],
    AUTH_INVALID_PASSWORD: ['当前密码不正确，请核对后重试。', 'The current password is incorrect. Check it and try again.'],
    AUTH_PASSWORD_INVALID: ['密码不正确，或新密码不符合要求。请核对当前密码，并使用至少 10 位的新密码。', 'The password is incorrect or does not meet the requirements. Check the current password and use at least 10 characters for a new password.'],
    AUTH_PASSWORD_INCORRECT: ['当前密码不正确，请核对后重试。', 'The current password is incorrect. Check it and try again.'],
    AUTH_INVALID_CREDENTIALS: ['邮箱或密码不正确，请核对后重试。', 'The email or password is incorrect. Check it and try again.'],
    AUTH_PROVIDER_NOT_CONFIGURED: ['此快捷登录尚未配置，请使用邮箱和密码。', 'This sign-in provider is not configured. Use your email and password.'],
    AUTH_NOT_CONFIGURED: ['此快捷登录尚未配置，请使用邮箱和密码。', 'This sign-in provider is not configured. Use your email and password.'],
    AUTH_PROVIDER_INVALID_CONFIGURATION: ['此快捷登录配置需要检查，请使用邮箱和密码。', 'This sign-in provider needs configuration. Use your email and password.'],
    AUTH_INVALID_STATE: ['授权已失效或与当前浏览器不匹配，请重新开始登录。', 'Authorization expired or does not match this browser. Start sign-in again.'],
    AUTH_OAUTH_CANCELLED: ['你已取消授权，可以重新选择登录方式。', 'Authorization was cancelled. Choose a sign-in method to continue.'],
    AUTH_CONSENT_DENIED: ['你已取消平台授权，可以重新选择登录方式。', 'Provider authorization was cancelled. Choose a sign-in method to continue.'],
    AUTH_OAUTH_FAILED: ['快捷登录未完成，请重试或使用邮箱和密码。', 'Quick sign-in did not complete. Retry or use your email and password.'],
    AUTH_PROVIDER_ERROR: ['快捷登录未完成，请重试或使用邮箱和密码。', 'Quick sign-in did not complete. Retry or use your email and password.'],
    AUTH_INVALID_ID_TOKEN: ['快捷登录验证未通过，请重新开始登录。', 'Provider verification failed. Start sign-in again.'],
    AUTH_INVALID_PROVIDER_RESPONSE: ['快捷登录返回的结果未通过验证，请重新尝试或使用邮箱和密码。', 'The provider response could not be verified. Retry or use email and password.'],
    AUTH_PROVIDER_TIMEOUT: ['快捷登录服务响应超时，请重新尝试。', 'The sign-in provider timed out. Please try again.'],
    AUTH_PROVIDER_UNAVAILABLE: ['快捷登录服务暂不可用，请稍后重试或使用邮箱和密码。', 'The sign-in provider is unavailable. Retry later or use email and password.'],
    AUTH_IDENTITY_IN_USE: ['此快捷登录已绑定其他账户。请使用该账户原有的方式登录。', 'This provider identity is linked to another account. Sign in using that account’s existing method.'],
    AUTH_PROVIDER_EMAIL_REQUIRED: ['平台未提供已验证邮箱。请先在平台确认邮箱，或使用邮箱和密码注册。', 'The provider did not supply a verified email. Verify it with the provider or register with email and password.'],
    AUTH_EMAIL_IN_USE: ['这个邮箱已有账户。请先使用原登录方式登录，再在设置中绑定快捷登录。', 'An account already uses this email. Sign in with its existing method, then link the provider in Settings.'],
    AUTH_ACCOUNT_EXISTS: ['这个邮箱已有账户。请先登录，再在设置中绑定快捷登录。', 'An account already uses this email. Sign in first, then link the provider in Settings.'],
    AUTH_LINK_REQUIRED: ['请先登录原账户，再在设置中验证密码并绑定此登录方式。', 'Sign in to your existing account, then confirm its password in Settings to link this provider.'],
    AUTH_PROVIDER_LINK_REQUIRED: ['请先登录原账户，再在设置中验证密码并绑定此登录方式。', 'Sign in to your existing account, then confirm its password in Settings to link this provider.'],
    AUTH_SESSION_CHANGED: ['账户会话已变化，请重新登录后再试。', 'The account session changed. Sign in again before retrying.'],
    AUTH_REAUTH_REQUIRED: ['请重新使用快捷登录验证身份，再回到设置中设置密码。', 'Sign in again with your provider, then return to Settings to set a password.'],
  };
  if (code && messages[code]) return messages[code][zh ? 0 : 1];
  if (cause instanceof api.ApiError) {
    if (cause.status === 429) return zh ? '操作过于频繁，请稍后再试。' : 'Too many attempts. Please try again later.';
    if (cause.status === 401) return zh ? '邮箱或密码不正确，或会话已失效。请重新登录。' : 'The email or password is incorrect, or the session expired. Sign in again.';
    if (cause.status === 409) return zh ? '账户或登录方式已存在或发生变化。请使用原方式登录后，在设置中核对。' : 'The account or sign-in method already exists or changed. Sign in with your existing method and check Settings.';
    if (cause.status === 400) return zh ? '填写内容或链接无效。请核对后重试；过期链接需要重新申请。' : 'The details or link are invalid. Check and retry; request a new link if it expired.';
  }
  return zh ? '暂时无法完成操作，请检查网络后重试。' : 'Could not complete this action. Check your connection and try again.';
}

export function PasswordField({ label, value, onChange, autoComplete = 'new-password', disabled = false, minLength = 10 }: {
  label: string; value: string; onChange: (value: string) => void; autoComplete?: string; disabled?: boolean; minLength?: number;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const zh = /[\u3400-\u9fff]/.test(label);
  return <div className="field">
    <label htmlFor={id}><LockKeyhole size={15} aria-hidden="true" /> {label}</label>
    <div className="auth-password">
      <input id={id} className="input" required type={visible ? 'text' : 'password'} minLength={minLength} maxLength={128} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} disabled={disabled} />
      <button type="button" className="icon-button" disabled={disabled} aria-label={(visible ? zh ? '隐藏' : 'Hide ' : zh ? '显示' : 'Show ') + label} aria-pressed={visible} onClick={() => setVisible(current => !current)}>{visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
    </div>
  </div>;
}

/** A server-provided sign-in destination still must be an official HTTPS authorization host. */
export function navigateToSignIn(authorizationUrl: string, provider: SignInProvider) {
  const url = new URL(authorizationUrl);
  if (url.protocol !== 'https:' || url.username || url.password ||
    (url.port !== '' && url.port !== '443') || url.hash ||
    url.hostname !== (provider === 'google' ? 'accounts.google.com' : 'appleid.apple.com') ||
    url.pathname !== (provider === 'google' ? '/o/oauth2/v2/auth' : '/auth/authorize')) throw new Error('Invalid authorization destination');
  window.location.assign(url.href);
}

const initialMode = (entry?: AuthEntry): AuthMode => entry && entry.kind !== 'error' ? entry.kind : 'login';

export function Auth({ lang, onClose, onAuthenticated, onPasswordReset, entry }: {
  lang: Language;
  onClose: () => void;
  onAuthenticated: (user: User) => Promise<void>;
  onPasswordReset?: () => void;
  entry?: AuthEntry;
}) {
  const zh = lang === 'zh';
  const [mode, setMode] = useState<AuthMode>(() => initialMode(entry));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [completed, setCompleted] = useState(false);
  const [pending, setPending] = useState(false);
  const [options, setOptions] = useState<AuthOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const mounted = useRef(false);
  const epoch = useRef(0);
  const pendingRef = useRef(false);
  const redirecting = useRef(false);
  const actionController = useRef<AbortController | null>(null);
  const optionsController = useRef<AbortController | null>(null);
  const optionsEpoch = useRef(0);
  const entryValue = entry ? 'token' in entry ? entry.token : 'ticket' in entry ? entry.ticket : entry.code : '';

  async function loadOptions() {
    const sequence = ++optionsEpoch.current;
    optionsController.current?.abort();
    const controller = new AbortController();
    optionsController.current = controller;
    setOptionsLoading(true); setOptionsFailed(false);
    try {
      const next = await api.getAuthOptions(controller.signal);
      if (mounted.current && sequence === optionsEpoch.current && !controller.signal.aborted) setOptions(next);
    } catch {
      if (mounted.current && sequence === optionsEpoch.current && !controller.signal.aborted) { setOptions(null); setOptionsFailed(true); }
    } finally {
      if (mounted.current && sequence === optionsEpoch.current && !controller.signal.aborted) setOptionsLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void loadOptions();
    const resume = () => {
      if (!redirecting.current) return;
      redirecting.current = false; epoch.current++; actionController.current?.abort();
      pendingRef.current = false; setPending(false);
    };
    window.addEventListener('pageshow', resume);
    return () => {
      mounted.current = false; epoch.current++; optionsEpoch.current++;
      actionController.current?.abort(); optionsController.current?.abort();
      window.removeEventListener('pageshow', resume);
    };
  }, []);
  useEffect(() => {
    epoch.current++; actionController.current?.abort(); pendingRef.current = false; redirecting.current = false;
    setPending(false); setMode(initialMode(entry)); setPassword(''); setConfirmation('');
    setError(entry?.kind === 'error' ? authErrorMessage(entry.code, zh) : ''); setNotice(''); setCompleted(false);
  }, [entry?.kind, entryValue]);

  async function runAction(action: (signal: AbortSignal, current: () => boolean) => Promise<void>) {
    if (!mounted.current || pendingRef.current) return;
    pendingRef.current = true;
    const sequence = ++epoch.current;
    const controller = new AbortController();
    actionController.current = controller;
    const current = () => mounted.current && epoch.current === sequence && !controller.signal.aborted;
    setPending(true); setError(''); setNotice('');
    try { await action(controller.signal, current); }
    catch (cause) { if (current()) setError(authErrorMessage(cause, zh)); }
    finally { if (current() && !redirecting.current) { pendingRef.current = false; setPending(false); actionController.current = null; } }
  }
  function changeMode(next: AuthMode) {
    if (pendingRef.current) return;
    setMode(next); setError(''); setNotice(''); setPassword(''); setConfirmation(''); setCompleted(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    if ((mode === 'register' || mode === 'reset') && password !== confirmation) {
      setError(zh ? '两次输入的密码不一致。' : 'The passwords do not match.'); return;
    }
    if (mode === 'forgot' && !options?.email.mailAvailable) {
      setError(authErrorMessage('AUTH_MAIL_NOT_CONFIGURED', zh)); return;
    }
    await runAction(async (signal, current) => {
      if (mode === 'forgot') {
        await api.forgotPassword(email.trim(), signal);
        if (current()) setNotice(zh ? '如果该邮箱已注册，我们会发送重置链接。请查看收件箱及垃圾邮件。' : 'If this email has an account, we will send a reset link. Check your inbox and spam folder.');
        return;
      }
      if (mode === 'reset' && entry?.kind === 'reset') {
        await api.resetPassword(entry.token, password, signal);
        if (current()) { setCompleted(true); setPassword(''); setConfirmation(''); onPasswordReset?.(); }
        return;
      }
      if (mode === 'verify' && entry?.kind === 'verify') {
        await api.verifyEmail(entry.token, signal);
        if (current()) setCompleted(true);
        return;
      }
      const result = mode === 'oauth' && entry?.kind === 'oauth'
        ? await api.completeSignIn(entry.ticket, signal)
        : mode === 'register' ? await api.register(email.trim(), password, name.trim(), signal)
        : await api.login(email.trim(), password, signal);
      if (!current()) return;
      setPassword(''); setConfirmation('');
      await onAuthenticated(result.user);
    });
  }
  function socialSignIn(provider: SignInProvider) {
    if (!options?.providers[provider].available) return;
    void runAction(async (signal, current) => {
      const result = await api.startSignIn(provider, 'login', undefined, undefined, signal);
      if (current()) { navigateToSignIn(result.authorizationUrl, provider); redirecting.current = true; }
    });
  }
  const ordinary = mode === 'login' || mode === 'register';
  const title = mode === 'forgot' ? zh ? '找回密码' : 'Reset your password'
    : mode === 'reset' ? zh ? '设置新密码' : 'Choose a new password'
    : mode === 'verify' ? zh ? '验证邮箱' : 'Verify your email'
    : mode === 'oauth' ? zh ? '完成快捷登录' : 'Complete sign-in'
    : mode === 'register' ? zh ? '创建 Forma 账户' : 'Create your Forma account'
    : zh ? '登录 Forma' : 'Sign in to Forma';
  return <Modal title={title} description={ordinary ? zh ? '记录饮食、训练与休息，让进展属于你。' : 'Keep your meals, training and rest together.' : undefined} onClose={() => { if (!pendingRef.current) onClose(); }} closeDisabled={pending}>
    <div className="auth-surface stack" aria-busy={pending}>
      {ordinary ? <>
        <div className="segmented" aria-label={zh ? '账户操作' : 'Account action'}>
          {(['login', 'register'] as const).map(next => <button type="button" key={next} disabled={pending} className={mode === next ? 'selected' : ''} aria-pressed={mode === next} onClick={() => changeMode(next)}>{next === 'login' ? zh ? '登录' : 'Sign in' : zh ? '创建账户' : 'Create account'}</button>)}
        </div>
        <div className="auth-provider-list">
          {(['google', 'apple'] as const).map(provider => <div className="auth-provider-option" key={provider}>
            <button type="button" className="btn btn-secondary full-width" disabled={pending || optionsLoading || !options?.providers[provider].available} onClick={() => socialSignIn(provider)}>{zh ? '使用 ' : 'Continue with '}{provider === 'google' ? 'Google' : 'Apple'}{zh ? ' 登录' : ''}</button>
            {!optionsLoading && !optionsFailed && !options?.providers[provider].available ? <p className="auth-provider-status">{options?.providers[provider].reason === 'invalid_configuration' ? zh ? '配置需要检查，可使用邮箱和密码登录。' : 'Configuration needs attention. Use email and password.' : zh ? '尚未配置，可使用邮箱和密码登录。' : 'Not configured. Use email and password.'}</p> : null}
          </div>)}
        </div>
        {optionsLoading ? <p className="auth-provider-status" role="status">{zh ? '正在检查快捷登录…' : 'Checking sign-in providers…'}</p> : null}
        {optionsFailed ? <div className="auth-status-row"><p className="auth-provider-status">{zh ? '暂时无法读取快捷登录状态，邮箱密码仍可使用。' : 'Provider status is unavailable. Email and password are still available.'}</p><button type="button" className="btn btn-ghost" disabled={pending} onClick={() => void loadOptions()}><RefreshCw size={15} />{zh ? '重试' : 'Retry'}</button></div> : null}
        <div className="auth-divider"><span>{zh ? '或使用邮箱' : 'or use email'}</span></div>
      </> : null}
      {completed ? <div className="auth-complete stack" role="status">
        <CheckCircle2 size={30} aria-hidden="true" />
        <strong>{mode === 'reset' ? zh ? '密码已重置，请使用新密码重新登录。' : 'Password reset. Sign in with your new password.' : zh ? '邮箱已验证。' : 'Your email is verified.'}</strong>
        <button className="btn btn-primary" type="button" onClick={() => changeMode('login')}>{zh ? '继续登录' : 'Continue to sign-in'}</button>
        {mode === 'verify' ? <button className="btn btn-ghost" type="button" onClick={onClose}>{zh ? '关闭' : 'Close'}</button> : null}
      </div> : <form onSubmit={submit} className="stack auth-form">
        <fieldset disabled={pending} className="auth-fieldset stack">
          {mode === 'register' ? <label className="field">{zh ? '怎么称呼你' : 'Your name'}<input className="input" required maxLength={60} value={name} onChange={event => setName(event.target.value)} autoComplete="given-name" /></label> : null}
          {ordinary || mode === 'forgot' ? <label className="field"><span><Mail size={15} aria-hidden="true" />{zh ? '邮箱' : 'Email'}</span><input className="input" required type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" inputMode="email" /></label> : null}
          {ordinary || mode === 'reset' ? <PasswordField key={mode + '-password'} label={mode === 'login' ? zh ? '密码' : 'Password' : zh ? '新密码（至少 10 位）' : 'New password (10+ characters)'} value={password} onChange={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} disabled={pending} /> : null}
          {mode === 'register' || mode === 'reset' ? <PasswordField key={mode + '-confirmation'} label={zh ? '确认密码' : 'Confirm password'} value={confirmation} onChange={setConfirmation} disabled={pending} /> : null}
          {mode === 'forgot' ? <>
            <p className="hint">{optionsLoading ? zh ? '正在检查邮件发送状态…' : 'Checking email delivery…' : optionsFailed ? zh ? '暂时无法读取邮件发送状态，请重试。' : 'Email delivery status is unavailable. Please retry.' : options?.email.mailAvailable ? zh ? '输入注册邮箱，我们会发送限时、一次性密码重置链接。' : 'Enter your account email for a time-limited, one-time reset link.' : zh ? '本机尚未配置邮件发送，暂时无法找回密码。可返回使用原密码登录。' : 'Email delivery is not configured, so password recovery is unavailable. You can still sign in with your existing password.'}</p>
            {optionsFailed ? <button type="button" className="btn btn-ghost" disabled={pending || optionsLoading} onClick={() => void loadOptions()}><RefreshCw size={15} aria-hidden="true" />{zh ? '重试邮件状态' : 'Retry email status'}</button> : null}
          </> : null}
          {mode === 'reset' ? <p className="hint">{zh ? '确认后会重置密码并退出所有已有会话。' : 'Confirming resets your password and signs out all existing sessions.'}</p> : null}
          {mode === 'verify' ? <p className="hint">{zh ? '点击下方按钮确认验证此链接对应的邮箱。打开页面本身不会完成验证。' : 'Confirm below to verify the email associated with this link. Opening the page does not verify it.'}</p> : null}
          {mode === 'oauth' ? <p className="hint">{zh ? '授权已返回 Forma。点击下方按钮完成本次登录或账户绑定。' : 'Authorization returned to Forma. Confirm below to complete this sign-in or account link.'}</p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
          <button className="btn btn-primary full-width" type="submit" disabled={pending || (mode === 'forgot' && (optionsLoading || !options?.email.mailAvailable))}>
            {pending ? zh ? '正在处理…' : 'Working…' : mode === 'register' ? zh ? '创建账户' : 'Create account' : mode === 'forgot' ? zh ? '发送重置链接' : 'Send reset link' : mode === 'reset' ? zh ? '重置密码' : 'Reset password' : mode === 'verify' ? zh ? '确认验证邮箱' : 'Verify this email' : mode === 'oauth' ? zh ? '完成登录或绑定' : 'Complete sign-in or link' : zh ? '登录我的账户' : 'Sign in'}<ArrowRight size={18} aria-hidden="true" />
          </button>
        </fieldset>
        {mode === 'login' ? <button className="btn btn-ghost auth-text-button" type="button" disabled={pending} onClick={() => changeMode('forgot')}>{zh ? '忘记密码？' : 'Forgot password?'}</button> : null}
        {!ordinary ? <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => changeMode('login')}>{zh ? '返回登录' : 'Back to sign-in'}</button> : null}
        {mode === 'register' ? <p className="hint">{zh ? '注册后可在设置中验证邮箱。Google 和 Apple 也可在登录后，经密码确认绑定到此账户。' : 'Verify your email in Settings after registration. You can also link Google or Apple after signing in and confirming your password.'}</p> : null}
      </form>}
    </div>
  </Modal>;
}
