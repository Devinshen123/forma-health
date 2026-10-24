import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { AuthOptions, SignInProvider } from '../../src/auth';
import type { Store } from '../store';
import { AuthError, endpoints, resolveAuthConfig, type AuthConfig, type AuthMail, type AuthMailer } from './config';
import { AuthLedger } from './ledger';
import { appleClientSecret, AuthHttp, digestAuth, OidcVerifier } from './oidc';
import { checkPassword, hashPassword } from './password';

export const AUTH_BROWSER_COOKIE = 'forma_auth_oauth';
export const AUTH_BROWSER_PATH = '/api/auth/oauth/complete';
export class AuthService {
  readonly ledger: AuthLedger;
  private readonly config: ReturnType<typeof resolveAuthConfig>;
  private readonly http: AuthHttp;
  private readonly verifier: OidcVerifier;
  private readonly pkce = new Map<string, { value: string; expires: number }>();
  private closed = false;
  constructor(private readonly store: Store, config: AuthConfig | undefined, transport: typeof fetch = fetch, private readonly now: () => number = Date.now, private readonly mailer?: AuthMailer) {
    this.config = resolveAuthConfig(config); this.ledger = new AuthLedger(store.db);
    this.http = new AuthHttp(transport, this.config.timeoutMs); this.verifier = new OidcVerifier(this.http, now);
  }
  close() { this.closed = true; this.http.close(); this.pkce.clear(); }
  mailAvailable() { return !!this.config.baseUrl && (!!this.mailer || !!this.config.resend); }
  options(): AuthOptions { return { email: { available: true, mailAvailable: this.mailAvailable() }, providers: { google: { available: !!this.config.providers.google, reason: this.config.reasons.google }, apple: { available: !!this.config.providers.apple, reason: this.config.reasons.apple } } }; }
  security(owner: string) { return this.ledger.security(owner, this.mailAvailable()); }
  cancelSession(token: string) { this.ledger.revokeSession(token); }
  cancelAccount(owner: string) { this.ledger.revokeAccount(owner); }
  sessionVersion(owner: string) { return this.ledger.version(owner); }
  sessionCurrent(owner: string, token: string, version?: number) {
    if (!this.ledger.liveSession(owner, digestAuth(token)) || version !== undefined && this.ledger.version(owner) !== version) throw new AuthError('AUTH_SESSION_CHANGED', 401);
  }
  private requireMail() { if (!this.mailAvailable()) throw new AuthError('AUTH_MAIL_NOT_CONFIGURED', 503); }
  private queueMail(message: AuthMail, token: string) {
    // Recovery responses are independent of account existence or mail transport
    // success. Accepted means queued; messages and tokens never enter logs.
    queueMicrotask(() => {
      if (this.closed) return;
      void this.sendMail(message).catch(() => {
        try { if (!this.closed && this.ledger.db.isOpen) this.ledger.db.prepare('DELETE FROM auth_mail_tokens WHERE token_hash=?').run(digestAuth(token)); }
        catch { /* Delivery cleanup must not become an unhandled rejection or enumeration signal. */ }
      });
    });
  }
  private async sendMail(message: AuthMail) {
    if (this.mailer) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([this.mailer(message), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new AuthError('AUTH_MAIL_UNAVAILABLE', 503)), this.config.timeoutMs); })]); }
      finally { if (timer) clearTimeout(timer); }
      return;
    }
    const resend = this.config.resend;
    if (!resend) throw new AuthError('AUTH_MAIL_NOT_CONFIGURED', 503);
    await this.http.json('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resend.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: resend.from, to: [message.to], subject: message.subject, text: message.text }) });
  }
  forgot(email: string) {
    this.requireMail();
    const account = this.store.accountByEmail(email);
    this.ledger.rate(`reset:${email}`, this.now(), account?.id ?? null);
    if (account) {
      const token = this.ledger.mailToken(account.id, 'reset', this.now());
      this.queueMail({ to: account.email, subject: 'Reset your Forma password', text: `Use this link to choose a new password. It expires in 30 minutes.\n${this.config.baseUrl}/#auth=reset&token=${token}\nIf you did not request this, ignore this message.` }, token);
    }
    return { ok: true as const, delivery: 'accepted' as const };
  }
  sendVerification(owner: string, session: string) {
    this.requireMail(); this.sessionCurrent(owner, session);
    this.ledger.rate(`verify:${owner}`, this.now(), owner);
    const account = this.store.db.prepare('SELECT email FROM accounts WHERE id=?').get(owner);
    if (!account) throw new AuthError('AUTH_SESSION_CHANGED', 401);
    const token = this.ledger.mailToken(owner, 'verify', this.now());
    this.queueMail({ to: String(account.email), subject: 'Verify your Forma email', text: `Confirm your email address using this link. It expires in 24 hours.\n${this.config.baseUrl}/#auth=verify&token=${token}\nIf you did not request this, ignore this message.` }, token);
    return { ok: true as const, delivery: 'accepted' as const };
  }
  verifyEmail(token: string) { this.ledger.verifyEmail(token, this.now()); return { ok: true as const }; }
  async resetPassword(token: string, password: string) {
    // Validate expiry/version again after scrypt, inside the committing transaction.
    const value = await hashPassword(password);
    if (this.closed) throw new AuthError('AUTH_SESSION_CHANGED', 401);
    return this.ledger.passwordByReset(token, value.hash, value.salt, this.now());
  }
  async changePassword(owner: string, session: string, password: string, currentPassword?: string) {
    this.sessionCurrent(owner, session);
    const version = this.ledger.version(owner), security = this.security(owner);
    if (security.hasPassword) {
      const account = this.store.accountByEmail(String(this.store.db.prepare('SELECT email FROM accounts WHERE id=?').get(owner)?.email));
      if (!currentPassword || !await checkPassword(currentPassword, account)) throw new AuthError('AUTH_PASSWORD_INVALID', 401);
    } else if (!this.ledger.freshSession(owner, digestAuth(session), this.now())) throw new AuthError('AUTH_REAUTH_REQUIRED', 401);
    const value = await hashPassword(password);
    if (this.closed) throw new AuthError('AUTH_SESSION_CHANGED', 401);
    this.ledger.passwordBySession(owner, digestAuth(session), version, value.hash, value.salt, this.now());
    return this.store.accountByEmail(String(this.store.db.prepare('SELECT email FROM accounts WHERE id=?').get(owner)?.email))!;
  }
  async start(provider: SignInProvider, intent: 'login' | 'link', session?: { token: string; owner: string }, password?: string) {
    const config = this.config.providers[provider];
    if (!config || !this.config.baseUrl) throw new AuthError('AUTH_PROVIDER_NOT_CONFIGURED', 503);
    let version: number | null = null;
    if (session) { this.sessionCurrent(session.owner, session.token); version = this.sessionVersion(session.owner); }
    if (intent === 'link') {
      if (!session) throw new AuthError('AUTH_SESSION_CHANGED', 401);
      const account = this.store.db.prepare('SELECT * FROM accounts WHERE id=?').get(session.owner) as any;
      if (!this.security(session.owner).hasPassword || !password || !await checkPassword(password, account)) throw new AuthError('AUTH_PASSWORD_INVALID', 401);
      this.sessionCurrent(session.owner, session.token, version!);
    }
    const state = randomBytes(32).toString('hex'), nonce = randomBytes(32).toString('hex'), binding = randomBytes(32).toString('hex'), stateHash = digestAuth(state);
    const now = this.now();
    for (const [key, entry] of this.pkce) if (entry.expires <= now) this.pkce.delete(key);
    if (this.pkce.size > 5000) throw new AuthError('AUTH_RATE_LIMIT', 429);
    this.ledger.start({ state_hash: stateHash, provider, intent, owner_id: session?.owner ?? null, session_hash: session ? digestAuth(session.token) : null, binding_hash: digestAuth(binding), nonce_hash: digestAuth(nonce), phase: 'started', created_ms: now, expires_ms: now + 10 * 60000, password_version: version }, now);
    const url = new URL(endpoints[provider].authorization);
    url.searchParams.set('client_id', config.clientId); url.searchParams.set('redirect_uri', `${this.config.baseUrl}/auth/callback/${provider}`);
    url.searchParams.set('response_type', 'code'); url.searchParams.set('scope', provider === 'google' ? 'openid email profile' : 'email');
    url.searchParams.set('state', state); url.searchParams.set('nonce', nonce);
    if (provider === 'google') {
      const verifier = randomBytes(48).toString('base64url'); this.pkce.set(stateHash, { value: verifier, expires: now + 10 * 60000 });
      url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url')); url.searchParams.set('code_challenge_method', 'S256');
    } else url.searchParams.set('response_mode', 'form_post');
    return { authorizationUrl: url.toString(), binding };
  }
  async callback(provider: SignInProvider, state: string, code?: string, denied = false) {
    const config = this.config.providers[provider];
    if (!config || !this.config.baseUrl) throw new AuthError('AUTH_PROVIDER_NOT_CONFIGURED', 503);
    const pending = this.ledger.takeCallback(digestAuth(state), provider, this.now());
    const verifier = this.pkce.get(pending.state_hash); this.pkce.delete(pending.state_hash);
    if (denied) throw new AuthError('AUTH_CONSENT_DENIED');
    if (!code || provider === 'google' && (!verifier || verifier.expires <= this.now())) throw new AuthError('AUTH_INVALID_STATE');
    const body = new URLSearchParams({ grant_type: 'authorization_code', code, client_id: config.clientId, client_secret: provider === 'apple' ? appleClientSecret(config, this.now()) : config.clientSecret!, redirect_uri: `${this.config.baseUrl}/auth/callback/${provider}` });
    if (provider === 'google') body.set('code_verifier', verifier!.value);
    const raw = await this.http.json(endpoints[provider].token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    const response = z.object({ id_token: z.string().min(1).max(20000) }).passthrough().safeParse(raw);
    if (!response.success) throw new AuthError('AUTH_INVALID_PROVIDER_RESPONSE', 502);
    const identity = await this.verifier.verify(response.data.id_token, provider, config.clientId, pending.nonce_hash);
    if (this.closed) throw new AuthError('AUTH_SESSION_CHANGED', 401);
    return this.ledger.ticket(pending, identity, this.now());
  }
  complete(ticket: string, binding: string, session?: string) { return this.ledger.complete(ticket, binding, session, this.now()); }
  resultUrl(kind: 'oauth' | 'error', value: string) {
    const base = this.config.baseUrl || 'http://127.0.0.1:3001';
    return `${base}/#auth=${kind}&${kind === 'oauth' ? 'ticket' : 'code'}=${encodeURIComponent(value)}`;
  }
}
