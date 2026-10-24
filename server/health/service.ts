import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HEALTH_PROVIDERS, type HealthConnection, type HealthProvider, type HealthSyncResponse } from '../../src/health';
import type { Store } from '../store';
import { appleImportSchema, cloudProviders, definitions, HealthError, resolveHealthConfig, type CloudProvider, type HealthConfig } from './model';
import { decrypt, digest, encrypt, HealthLedger, type HealthTokens } from './ledger';
import { fetchHealthRecords, tokenResponse } from './providers';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const JOB_MS = 60000;
export const oauthCookieName = (provider: CloudProvider) => `forma_health_oauth_${provider.replaceAll('-', '_')}`;
export const oauthCookiePath = (provider: CloudProvider) => `/integrations/${provider}/callback`;
export class HealthService {
  readonly ledger: HealthLedger;
  private readonly config: ReturnType<typeof resolveHealthConfig>;
  private readonly jobs = new Map<string, AbortController>();
  private readonly locks = new Map<string, { owner: string; provider: CloudProvider; generation: number; lock: string }>();
  private timer?: ReturnType<typeof setInterval>;
  private closed = false;
  private polling = false;
  constructor(store: Store, config?: HealthConfig, private readonly transport: typeof fetch = fetch, private readonly now: () => number = Date.now) {
    this.ledger = new HealthLedger(store.db); this.config = resolveHealthConfig(config);
    if (this.config.pollIntervalMs && Object.keys(this.config.providers).length) {
      this.timer = setInterval(() => { void this.poll(); }, this.config.pollIntervalMs);
      this.timer.unref();
    }
  }
  close() {
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    for (const controller of this.jobs.values()) controller.abort();
    for (const lock of this.locks.values()) this.ledger.release(lock.owner, lock.provider, lock.generation, lock.lock);
    this.locks.clear();
    this.jobs.clear();
  }
  private requireConfig(provider: CloudProvider) {
    const config = this.config.providers[provider];
    if (!config || !this.config.key || !this.config.baseUrl) throw new HealthError('HEALTH_NOT_CONFIGURED', 503);
    return config;
  }
  connection(owner: string, provider: HealthProvider): HealthConnection {
    const row = this.ledger.row(owner, provider), native = provider === 'apple-health';
    const configured = native || !!this.config.providers[provider];
    const scopes = row ? JSON.parse(row.scopes_json) as string[] : [];
    return {
      provider, configured, status: !configured ? 'not_configured' : row?.status ?? (native ? 'needs_iphone' : 'disconnected'),
      reason: !configured ? 'credentials_or_token_key_missing' : native ? 'requires_native_iphone_read_and_explicit_upload' : 'recent_window_polling_remote_deletions_not_inferred',
      scopes, connectedAt: row?.connected_at ?? null, lastSyncAt: row?.last_sync_at ?? null, lastError: row?.last_error ?? null,
      recordCount: this.ledger.count(owner, provider), syncRevision: row?.generation ?? 0,
      callbackUrl: native ? null : this.config.baseUrl ? `${this.config.baseUrl}${oauthCookiePath(provider)}` : null,
      applicationUrl: native ? 'https://developer.apple.com/documentation/healthkit' : definitions[provider].application,
    };
  }
  connections(owner: string) { return { connections: HEALTH_PROVIDERS.map(provider => this.connection(owner, provider)) }; }
  private cancel(owner: string, provider: HealthProvider) { this.jobs.get(`${owner}:${provider}`)?.abort(); }
  cancelAccount(owner: string) {
    for (const provider of HEALTH_PROVIDERS) this.cancel(owner, provider);
    this.ledger.db.prepare('DELETE FROM health_oauth_states WHERE owner_id=?').run(owner);
  }
  cancelSession(session: string) { this.ledger.cancelSession(session); }
  beginConnect(owner: string, session: string, provider: CloudProvider) {
    const credentials = this.requireConfig(provider);
    this.cancel(owner, provider);
    const state = randomBytes(32).toString('hex'), binding = randomBytes(32).toString('hex'), verifier = randomBytes(48).toString('base64url');
    const context = `${owner}:${provider}:oauth:${digest(state)}`;
    this.ledger.beginOAuth(owner, provider, { state_hash: digest(state), session_hash: digest(session), binding_hash: digest(binding),
      verifier_cipher: encrypt(verifier, this.config.key!, context), expires_ms: this.now() + 10 * 60000 }, this.now());
    const url = new URL(definitions[provider].authorization);
    url.searchParams.set('client_id', credentials.clientId); url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', `${this.config.baseUrl}${oauthCookiePath(provider)}`);
    url.searchParams.set('scope', definitions[provider].scopes.join(' ')); url.searchParams.set('state', state);
    if (provider !== 'whoop') {
      url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url')); url.searchParams.set('code_challenge_method', 'S256');
    }
    if (provider === 'google-health') { url.searchParams.set('access_type', 'offline'); url.searchParams.set('prompt', 'consent'); }
    return { authorizationUrl: url.toString(), binding };
  }
  async callback(provider: CloudProvider, input: { state: string; code?: string; error?: string }, binding: string, currentSession?: string) {
    const credentials = this.requireConfig(provider);
    const pending = this.ledger.consumeOAuth(input.state, provider, binding, currentSession, this.now());
    if (input.error !== undefined) throw new HealthError('HEALTH_CONSENT_DENIED', 400);
    if (!input.code) throw new HealthError('HEALTH_OAUTH_INVALID', 400);
    const key = `${pending.owner_id}:${provider}`;
    const controller = new AbortController(); this.jobs.set(key, controller);
    const timer = setTimeout(() => controller.abort(), JOB_MS);
    try {
      const body = new URLSearchParams({ grant_type: 'authorization_code', code: input.code, client_id: credentials.clientId, client_secret: credentials.clientSecret,
        redirect_uri: `${this.config.baseUrl}${oauthCookiePath(provider)}` });
      if (provider !== 'whoop') body.set('code_verifier', decrypt<string>(pending.verifier_cipher, this.config.key!, `${pending.owner_id}:${provider}:oauth:${digest(input.state)}`));
      const raw = await this.request(definitions[provider].token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }, controller.signal);
      const tokens = tokenResponse(raw, provider, this.now());
      if (provider === 'oura' && tokens.scopes.length === 0) tokens.scopes = await this.ouraGrantedScopes(tokens.accessToken, controller.signal);
      if (provider === 'google-health') {
        const identity = await this.request('https://health.googleapis.com/v4/users/me/identity', { headers: { Authorization: `Bearer ${tokens.accessToken}` } }, controller.signal);
        const parsed = z.object({ healthUserId: z.string().regex(/^[A-Za-z0-9-]{1,63}$/) }).passthrough().safeParse(identity);
        if (!parsed.success) throw new HealthError('HEALTH_ACCOUNT_NOT_LINKED', 409);
        tokens.subjectId = parsed.data.healthUserId;
      }
      if (controller.signal.aborted || this.closed) throw new HealthError('HEALTH_CONNECTION_CHANGED', 409);
      this.ledger.connect(pending.owner_id, provider, pending.generation, encrypt(tokens, this.config.key!, `${pending.owner_id}:${provider}:tokens`), tokens.scopes, this.now(), pending.session_hash);
      return this.connection(pending.owner_id, provider);
    } finally { clearTimeout(timer); if (this.jobs.get(key) === controller) this.jobs.delete(key); }
  }
  private async ouraGrantedScopes(accessToken: string, signal: AbortSignal) {
    const scopes: string[] = [];
    const end = new Date(this.now()).toISOString().slice(0, 10), start = new Date(this.now() - 86400000).toISOString().slice(0, 10);
    for (const [scope, path] of [['daily', 'daily_readiness'], ['heartrate', 'heartrate'], ['workout', 'workout']]) {
      const url = new URL(`https://api.ouraring.com/v2/usercollection/${path}`);
      url.searchParams.set(path === 'heartrate' ? 'start_datetime' : 'start_date', path === 'heartrate' ? `${start}T00:00:00Z` : start);
      url.searchParams.set(path === 'heartrate' ? 'end_datetime' : 'end_date', path === 'heartrate' ? `${end}T00:00:00Z` : end);
      try {
        const response = await this.request(url, { headers: { Authorization: `Bearer ${accessToken}` } }, signal);
        if (!z.object({ data: z.array(z.unknown()).max(10000) }).passthrough().safeParse(response).success) throw new HealthError('HEALTH_INVALID_RESPONSE', 502);
        scopes.push(scope);
      }
      catch (error) { if (!(error instanceof HealthError) || error.code !== 'HEALTH_PERMISSION_REQUIRED') throw error; }
    }
    if (!scopes.length) throw new HealthError('HEALTH_MISSING_SCOPES', 409);
    return scopes;
  }
  private async request(url: string | URL, init: RequestInit = {}, parent?: AbortSignal): Promise<unknown> {
    const target = new URL(url);
    const allowed = ['api.prod.whoop.com', 'api.ouraring.com', 'oauth2.googleapis.com', 'health.googleapis.com'];
    if (target.protocol !== 'https:' || !allowed.includes(target.hostname) || target.username || target.password) throw new HealthError('HEALTH_INVALID_ENDPOINT', 500);
    const controller = new AbortController();
    const abort = () => controller.abort();
    parent?.addEventListener('abort', abort, { once: true });
    if (parent?.aborted || this.closed) controller.abort();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const operation = (async () => {
      const response = await this.transport(target.toString(), { ...init, redirect: 'error', signal: controller.signal });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        if (response.status === 401) throw new HealthError('HEALTH_REAUTHORIZE', 409);
        if (response.status === 403) throw new HealthError('HEALTH_PERMISSION_REQUIRED', 409);
        if (response.status === 400 && (target.pathname.endsWith('/token') || target.pathname.endsWith('/oauth2/token'))) throw new HealthError('HEALTH_REAUTHORIZE', 409);
        if (response.status === 400 && target.hostname === 'health.googleapis.com' && target.pathname.endsWith('/identity')) throw new HealthError('HEALTH_ACCOUNT_NOT_LINKED', 409);
        throw new HealthError(response.status === 429 ? 'HEALTH_PROVIDER_RATE_LIMIT' : 'HEALTH_PROVIDER_UNAVAILABLE', 502);
      }
      const length = Number(response.headers.get('content-length'));
      if (length > MAX_RESPONSE_BYTES || !response.body) { await response.body?.cancel().catch(() => undefined); throw new HealthError('HEALTH_RESPONSE_LIMIT', 502); }
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let total = 0;
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          total += chunk.value.length;
          if (total > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new HealthError('HEALTH_RESPONSE_LIMIT', 502); }
          chunks.push(chunk.value);
        }
        try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
        catch { throw new HealthError('HEALTH_INVALID_RESPONSE', 502); }
      } finally { reader.releaseLock(); }
    })();
    const abortPromise = new Promise<never>((_resolve, reject) => {
      const onAbort = () => reject(new HealthError('HEALTH_TIMEOUT', 504));
      controller.signal.addEventListener('abort', onAbort, { once: true });
      if (controller.signal.aborted) onAbort();
      timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    });
    try { return await Promise.race([operation, abortPromise]); }
    catch (error) { throw error instanceof HealthError ? error : new HealthError(controller.signal.aborted ? 'HEALTH_TIMEOUT' : 'HEALTH_PROVIDER_UNAVAILABLE', controller.signal.aborted ? 504 : 502); }
    finally { if (timeout) clearTimeout(timeout); parent?.removeEventListener('abort', abort); }
  }
  async sync(owner: string, provider: CloudProvider): Promise<HealthSyncResponse> {
    const credentials = this.requireConfig(provider), key = `${owner}:${provider}`;
    if (this.jobs.has(key)) throw new HealthError('HEALTH_SYNC_BUSY', 409);
    const lock = randomUUID(), row = this.ledger.lock(owner, provider, lock, this.now()), controller = new AbortController();
    this.locks.set(key, { owner, provider, generation: row.generation, lock });
    this.jobs.set(key, controller);
    const timer = setTimeout(() => controller.abort(), JOB_MS);
    try {
      if (!row.encrypted_tokens) throw new HealthError('HEALTH_REAUTHORIZE', 409);
      let tokens = decrypt<HealthTokens>(row.encrypted_tokens, this.config.key!, `${owner}:${provider}:tokens`);
      if (tokens.expiresAt <= this.now() + 60000) {
        if (!tokens.refreshToken) throw new HealthError('HEALTH_REAUTHORIZE', 409);
        const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken, client_id: credentials.clientId, client_secret: credentials.clientSecret });
        if (provider === 'whoop') body.set('scope', 'offline');
        tokens = tokenResponse(await this.request(definitions[provider].token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }, controller.signal), provider, this.now(), tokens);
        if (this.closed || controller.signal.aborted) throw new HealthError('HEALTH_CONNECTION_CHANGED', 409);
        // Persist rotated refresh credentials before reading any pages. A page failure
        // must not lose the single-use replacement refresh token.
        this.ledger.refresh(owner, provider, row.generation, lock, encrypt(tokens, this.config.key!, `${owner}:${provider}:tokens`), tokens.scopes);
      }
      const now = this.now(), startMs = Math.max(now - 7 * 86400000, row.last_sync_at ? Date.parse(row.last_sync_at) - 2 * 86400000 : 0);
      const records = await fetchHealthRecords(provider, tokens, new Date(startMs).toISOString(), new Date(now).toISOString(), (url, init) => this.request(url, init, controller.signal), this.config.maxPages);
      if (controller.signal.aborted || this.closed) throw new HealthError('HEALTH_CONNECTION_CHANGED', 409);
      const counts = this.ledger.save(owner, provider, records, [], now, { generation: row.generation, lock });
      this.ledger.release(owner, provider, row.generation, lock);
      return { ...counts, connection: this.connection(owner, provider) };
    } catch (error) {
      const failure = error instanceof HealthError ? error : new HealthError('HEALTH_SYNC_FAILED', 502);
      if (!this.closed) this.ledger.release(owner, provider, row.generation, lock, failure.code, ['HEALTH_REAUTHORIZE', 'HEALTH_PERMISSION_REQUIRED'].includes(failure.code));
      throw failure;
    } finally {
      clearTimeout(timer);
      if (this.jobs.get(key) === controller) this.jobs.delete(key);
      if (this.locks.get(key)?.lock === lock) this.locks.delete(key);
    }
  }
  importApple(owner: string, raw: unknown): HealthSyncResponse {
    const value = appleImportSchema.parse(raw);
    const counts = this.ledger.save(owner, 'apple-health', value.records, value.deletedIds, this.now(), { appleRevision: value.expectedRevision });
    return { ...counts, connection: this.connection(owner, 'apple-health') };
  }
  disconnect(owner: string, provider: HealthProvider) { this.cancel(owner, provider); this.ledger.disconnect(owner, provider); return this.connection(owner, provider); }
  deleteRecords(owner: string, provider: HealthProvider) { this.cancel(owner, provider); return { deleted: this.ledger.deleteRecords(owner, provider) }; }
  private async poll() {
    if (this.polling || this.closed) return;
    this.polling = true;
    try {
      const rows = this.ledger.db.prepare("SELECT owner_id,provider FROM health_connections WHERE status='connected' AND provider<>'apple-health' AND (last_sync_at IS NULL OR last_sync_at<?) LIMIT 50")
        .all(new Date(this.now() - this.config.pollIntervalMs).toISOString()) as { owner_id: string; provider: CloudProvider }[];
      for (const row of rows) {
        if (this.closed) break;
        if (!cloudProviders.includes(row.provider) || !this.config.providers[row.provider]) continue;
        try { await this.sync(row.owner_id, row.provider); } catch { /* Public connection status contains a sanitized error code. */ }
      }
    } finally { this.polling = false; }
  }
}
