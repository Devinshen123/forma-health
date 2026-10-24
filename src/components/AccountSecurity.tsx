import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import * as api from '../api';
import type { AccountSecurity as SecurityState, AuthOptions, SignInProvider } from '../auth';
import type { Language, User } from '../types';
import { authErrorMessage, navigateToSignIn, PasswordField } from './Auth';
import '../auth.css';

export function AccountSecurity({ lang, accountId, onSessionChanged }: {
  lang: Language;
  accountId: string;
  onSessionChanged: (user: User) => Promise<void>;
}) {
  const zh = lang === 'zh';
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [options, setOptions] = useState<AuthOptions | null>(null);
  const [loadedAccount, setLoadedAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [linkProvider, setLinkProvider] = useState<SignInProvider | null>(null);
  const [linkPassword, setLinkPassword] = useState('');
  const mounted = useRef(false);
  const account = useRef(accountId);
  account.current = accountId;
  const epoch = useRef(0);
  const loadEpoch = useRef(0);
  const pendingRef = useRef(false);
  const redirecting = useRef(false);
  const actionController = useRef<AbortController | null>(null);
  const loadController = useRef<AbortController | null>(null);
  const ready = loadedAccount === accountId && security !== null && options !== null;

  async function load() {
    if (pendingRef.current) return;
    const owner = accountId;
    const sequence = ++loadEpoch.current;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const current = () => mounted.current && account.current === owner && loadEpoch.current === sequence && !controller.signal.aborted;
    setLoading(true); setError('');
    try {
      const [nextSecurity, nextOptions] = await Promise.all([
        api.getAccountSecurity(owner, controller.signal), api.getAuthOptions(controller.signal),
      ]);
      if (current()) { setSecurity(nextSecurity); setOptions(nextOptions); setLoadedAccount(owner); }
    } catch (cause) { if (current()) setError(authErrorMessage(cause, zh)); }
    finally { if (current()) setLoading(false); }
  }
  useEffect(() => {
    mounted.current = true;
    epoch.current++; pendingRef.current = false; redirecting.current = false;
    setPending(false); setSecurity(null); setOptions(null); setLoadedAccount('');
    setError(''); setNotice(''); setPassword(''); setConfirmation(''); setCurrentPassword(''); setLinkPassword(''); setLinkProvider(null);
    void load();
    const resume = () => {
      if (!redirecting.current) return;
      redirecting.current = false; epoch.current++; actionController.current?.abort();
      pendingRef.current = false; setPending(false); void load();
    };
    window.addEventListener('pageshow', resume);
    return () => {
      mounted.current = false; epoch.current++; loadEpoch.current++;
      actionController.current?.abort(); loadController.current?.abort();
      window.removeEventListener('pageshow', resume);
    };
  }, [accountId]);

  async function runAction(action: (signal: AbortSignal, current: () => boolean) => Promise<void>) {
    if (!mounted.current || !ready || loading || pendingRef.current) return;
    pendingRef.current = true;
    const owner = accountId;
    const sequence = ++epoch.current;
    const controller = new AbortController();
    actionController.current = controller;
    const current = () => mounted.current && account.current === owner && epoch.current === sequence && !controller.signal.aborted;
    setPending(true); setError(''); setNotice('');
    try { await action(controller.signal, current); }
    catch (cause) { if (current()) setError(authErrorMessage(cause, zh)); }
    finally { if (current() && !redirecting.current) { pendingRef.current = false; setPending(false); actionController.current = null; } }
  }
  function sendVerification() {
    if (!security?.mailAvailable || security.emailVerified) return;
    void runAction(async (signal, current) => {
      await api.sendVerification(accountId, signal);
      if (current()) setNotice(zh ? '验证邮件已提交发送，请查看收件箱及垃圾邮件，点击邮件中的链接继续。' : 'The verification email was accepted for sending. Check your inbox and spam folder, then follow its link.');
    });
  }
  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current || !security) return;
    if (password !== confirmation) { setError(zh ? '两次输入的新密码不一致。' : 'The new passwords do not match.'); return; }
    await runAction(async (signal, current) => {
      const result = await api.changePassword(password, security.hasPassword ? currentPassword : undefined, accountId, signal);
      if (!current()) return;
      setSecurity(previous => previous ? { ...previous, hasPassword: true } : previous);
      setPassword(''); setConfirmation(''); setCurrentPassword(''); setLinkPassword(''); setLinkProvider(null);
      setNotice(zh ? '密码已更新，其他已有会话已退出。' : 'Your password is updated. Other existing sessions have been signed out.');
      await onSessionChanged(result.user);
    });
  }
  async function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const provider = linkProvider;
    if (!provider || !security?.hasPassword || !options?.providers[provider].available) return;
    await runAction(async (signal, current) => {
      const result = await api.startSignIn(provider, 'link', linkPassword, accountId, signal);
      if (current()) { setLinkPassword(''); navigateToSignIn(result.authorizationUrl, provider); redirecting.current = true; }
    });
  }
  const providerName = (provider: SignInProvider) => provider === 'google' ? 'Google' : 'Apple';
  return <section className="panel stack account-security" aria-busy={pending || loading}>
    <div className="section-title"><h2><ShieldCheck size={20} aria-hidden="true" /> {zh ? '账户与登录安全' : 'Account and sign-in security'}</h2><button type="button" className="btn btn-ghost" disabled={pending || loading} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" />{zh ? '刷新状态' : 'Refresh status'}</button></div>
    {loading ? <p className="muted" role="status">{zh ? '正在读取账户安全状态…' : 'Loading account security…'}</p> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
    {ready ? <>
      <div className="account-security-status"><div><strong>{zh ? '邮箱验证' : 'Email verification'}</strong><p className="muted">{security.emailVerified ? zh ? '邮箱已验证' : 'Email verified' : zh ? '邮箱尚未验证' : 'Email not yet verified'}</p></div>{!security.emailVerified ? <button type="button" className="btn btn-secondary" disabled={pending || loading || !security.mailAvailable} onClick={sendVerification}><Mail size={16} aria-hidden="true" />{zh ? '发送验证邮件' : 'Send verification email'}</button> : <span className="badge">{zh ? '已验证' : 'Verified'}</span>}</div>
      {!security.mailAvailable ? <p className="hint">{zh ? '本机尚未配置邮件发送。邮箱验证与找回密码暂不可用；邮箱密码登录仍可使用。' : 'Email delivery is not configured. Email verification and password recovery are unavailable; email and password sign-in remain available.'}</p> : null}
      <div className="account-security-password stack">
        <div><h3>{security.hasPassword ? zh ? '修改密码' : 'Change password' : zh ? '设置账户密码' : 'Set an account password'}</h3><p className="muted">{security.hasPassword ? zh ? '账户已设置密码。修改时需要确认当前密码。' : 'A password is set. Confirm your current password to change it.' : zh ? '此账户通过快捷登录创建。设置密码后可使用邮箱登录，并确认绑定和删除账户等操作。' : 'This account was created with a sign-in provider. A password enables email sign-in and confirms actions such as linking or deleting your account.'}</p></div>
        <form className="stack" onSubmit={submitPassword}>
          <fieldset className="auth-fieldset stack" disabled={pending || loading}>
            {security.hasPassword ? <PasswordField key={accountId + '-current'} label={zh ? '当前密码' : 'Current password'} value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" disabled={pending || loading} /> : <p className="hint">{zh ? '请在完成快捷登录后 15 分钟内设置；若会话过旧，需要重新快捷登录验证身份。' : 'Set a password within 15 minutes of signing in with your provider. An older session requires signing in again.'}</p>}
            <div className="form-grid"><PasswordField key={accountId + '-new'} label={zh ? '新密码（至少 10 位）' : 'New password (10+ characters)'} value={password} onChange={setPassword} disabled={pending || loading} /><PasswordField key={accountId + '-confirm'} label={zh ? '确认新密码' : 'Confirm new password'} value={confirmation} onChange={setConfirmation} disabled={pending || loading} /></div>
            <button type="submit" className="btn btn-secondary" disabled={pending || loading}>{pending ? zh ? '正在处理…' : 'Working…' : security.hasPassword ? zh ? '确认修改密码' : 'Update password' : zh ? '确认设置密码' : 'Set password'}</button>
          </fieldset>
        </form>
      </div>
      <div className="account-security-providers stack">
        <div><h3>{zh ? '快捷登录方式' : 'Sign-in providers'}</h3><p className="muted">{zh ? '绑定前需要确认当前账户密码，再由平台授权。相同邮箱不会自动合并账户。' : 'Link a provider by confirming your account password, then authorizing with the provider. Matching emails do not merge accounts automatically.'}</p></div>
        {!security.hasPassword ? <p className="hint">{zh ? '先设置账户密码，才能绑定其他快捷登录方式。' : 'Set an account password before linking another sign-in provider.'}</p> : null}
        <div className="auth-provider-list">{(['google', 'apple'] as const).map(provider => {
          const linked = security.providers.includes(provider);
          const available = options.providers[provider].available;
          return <div key={provider} className="auth-provider-option">
            <div className="account-security-status"><strong>{providerName(provider)}</strong><span className="badge">{linked ? zh ? '已绑定' : 'Linked' : zh ? '未绑定' : 'Not linked'}</span></div>
            {!available ? <p className="auth-provider-status" id={'auth-link-config-' + provider}>{options.providers[provider].reason === 'invalid_configuration' ? zh ? '快捷登录配置需要检查，暂不可用。' : 'Sign-in configuration needs attention and is unavailable.' : zh ? '此快捷登录尚未配置。' : 'This sign-in provider is not configured.'}</p> : null}
            {!linked ? <button className="btn btn-secondary full-width" type="button" disabled={pending || loading || !available || !security.hasPassword} aria-describedby={!available ? 'auth-link-config-' + provider : undefined} onClick={() => { if (!pendingRef.current) { setLinkProvider(provider); setLinkPassword(''); setError(''); setNotice(''); } }}>{zh ? '绑定 ' : 'Link '}{providerName(provider)}</button> : null}
          </div>;
        })}</div>
        {linkProvider ? <form className="auth-link-confirm stack" onSubmit={submitLink}>
          <strong>{zh ? '确认绑定 ' : 'Confirm linking '}{providerName(linkProvider)}</strong>
          <p className="hint">{zh ? '输入当前 Forma 密码后，将跳转平台授权，并将此登录方式绑定到当前账户。' : 'Enter your current Forma password to continue to provider authorization and link it to this account.'}</p>
          <fieldset className="auth-fieldset stack" disabled={pending || loading}>
            <PasswordField key={accountId + '-link-' + linkProvider} label={zh ? '确认当前账户密码' : 'Confirm current account password'} value={linkPassword} onChange={setLinkPassword} autoComplete="current-password" disabled={pending || loading} />
            <div className="row-actions"><button className="btn btn-secondary" type="button" disabled={pending || loading} onClick={() => { if (!pendingRef.current) { setLinkProvider(null); setLinkPassword(''); } }}>{zh ? '取消绑定' : 'Cancel'}</button><button className="btn btn-primary" type="submit" disabled={pending || loading}>{pending ? zh ? '正在处理…' : 'Working…' : zh ? '验证密码并前往 ' + providerName(linkProvider) : 'Confirm password and continue to ' + providerName(linkProvider)}</button></div>
          </fieldset>
        </form> : null}
      </div>
    </> : !loading ? <p className="hint">{zh ? '暂时无法读取账户安全状态，请刷新重试。' : 'Account security could not be loaded. Refresh to try again.'}</p> : null}
  </section>;
}
