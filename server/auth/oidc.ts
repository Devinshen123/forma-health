/** Official references checked 2026-10-24:
 * https://developers.google.com/identity/openid-connect/openid-connect
 * https://accounts.google.com/.well-known/openid-configuration
 * https://developer.apple.com/documentation/signinwithapple/verifying-a-user
 * https://developer.apple.com/documentation/SigninwithAppleRESTAPI/Generate-and-validate-tokens
 * https://developer.apple.com/documentation/signinwithapplerestapi/creating-a-client-secret
 * https://resend.com/docs/api-reference/emails/send-email
 */
import { createHash, createPublicKey, sign, verify, type JsonWebKey, type KeyObject } from 'node:crypto';
import { z } from 'zod';
import type { SignInProvider } from '../../src/auth';
import { AuthError, emailSchema, endpoints } from './config';

export const digestAuth = (value: string) => createHash('sha256').update(value).digest('hex');
export interface VerifiedIdentity { subject: string; email?: string; emailVerified: boolean; name?: string }
export class AuthHttp {
  private readonly active = new Set<AbortController>();
  constructor(private readonly transport: typeof fetch, private readonly timeoutMs: number) {}
  close() { for (const item of this.active) item.abort(); this.active.clear(); }
  async json(url: string, init: RequestInit = {}, limit = 128 * 1024): Promise<unknown> {
    if (![endpoints.google.token, endpoints.google.jwks, endpoints.apple.token, endpoints.apple.jwks, 'https://api.resend.com/emails'].includes(url as any)) throw new AuthError('AUTH_INVALID_ENDPOINT', 500);
    const controller = new AbortController(); this.active.add(controller);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = (async () => {
      const response = await this.transport(url, { ...init, signal: controller.signal, redirect: 'error' });
      if (!response.ok) { await response.body?.cancel().catch(() => undefined); throw new AuthError('AUTH_PROVIDER_UNAVAILABLE', 502); }
      if (!response.body || Number(response.headers.get('content-length')) > limit) { await response.body?.cancel().catch(() => undefined); throw new AuthError('AUTH_INVALID_PROVIDER_RESPONSE', 502); }
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let count = 0;
      try {
        while (true) { const next = await reader.read(); if (next.done) break; count += next.value.length;
          if (count > limit) { await reader.cancel(); throw new AuthError('AUTH_INVALID_PROVIDER_RESPONSE', 502); } chunks.push(next.value); }
        try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; } catch { throw new AuthError('AUTH_INVALID_PROVIDER_RESPONSE', 502); }
      } finally { reader.releaseLock(); }
    })();
    try {
      return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => reject(new AuthError('AUTH_PROVIDER_TIMEOUT', 504)), { once: true });
        timer = setTimeout(() => controller.abort(), this.timeoutMs);
      })]);
    } catch (error) { throw error instanceof AuthError ? error : new AuthError('AUTH_PROVIDER_UNAVAILABLE', 502); }
    finally { if (timer) clearTimeout(timer); this.active.delete(controller); }
  }
}

export class OidcVerifier {
  private readonly cache = new Map<SignInProvider, { until: number; loaded: number; keys: Map<string, KeyObject> }>();
  constructor(private readonly http: AuthHttp, private readonly now: () => number) {}
  private async keys(provider: SignInProvider, kid: string) {
    let cached = this.cache.get(provider);
    if (cached && cached.until > this.now() && (cached.keys.has(kid) || this.now() - cached.loaded < 30000)) return cached.keys;
    const response = await this.http.json(endpoints[provider].jwks, {}, 64 * 1024);
    const parsed = z.object({ keys: z.array(z.object({ kty: z.literal('RSA'), kid: z.string().min(1).max(200), n: z.string().min(1).max(1500).regex(/^[A-Za-z0-9_-]+$/), e: z.string().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/), alg: z.literal('RS256').optional(), use: z.literal('sig').optional() }).passthrough()).min(1).max(20) }).passthrough().safeParse(response);
    if (!parsed.success) throw new AuthError('AUTH_INVALID_ID_TOKEN', 400);
    const keys = new Map<string, KeyObject>();
    try {
      for (const jwk of parsed.data.keys) {
        if (keys.has(jwk.kid)) throw new Error();
        if (Array.isArray(jwk.key_ops) && !jwk.key_ops.includes('verify')) throw new Error();
        const key = createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' });
        const bits = key.asymmetricKeyDetails?.modulusLength ?? 0;
        if (bits < 2048 || bits > 8192) throw new Error(); keys.set(jwk.kid, key);
      }
    } catch { throw new AuthError('AUTH_INVALID_ID_TOKEN', 400); }
    cached = { keys, loaded: this.now(), until: this.now() + 5 * 60000 }; this.cache.set(provider, cached);
    return keys;
  }
  async verify(token: string, provider: SignInProvider, clientId: string, nonceHash: string): Promise<VerifiedIdentity> {
    try {
      if (token.length > 20000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new AuthError('AUTH_INVALID_ID_TOKEN');
      const [head, body, signature] = token.split('.');
      const header = z.object({ alg: z.literal('RS256'), kid: z.string().min(1).max(200), crit: z.never().optional() }).passthrough().parse(JSON.parse(Buffer.from(head, 'base64url').toString('utf8')));
      const key = (await this.keys(provider, header.kid)).get(header.kid);
      if (!key || !verify('RSA-SHA256', Buffer.from(`${head}.${body}`), key, Buffer.from(signature, 'base64url'))) throw new AuthError('AUTH_INVALID_ID_TOKEN');
      const claims = z.object({ iss: z.string(), sub: z.string().min(1).max(255).regex(/^[\x21-\x7e]+$/), aud: z.union([z.string(), z.array(z.string()).min(1).max(10)]), exp: z.number().int(), iat: z.number().int(), nbf: z.number().int().optional(), azp: z.string().optional(), nonce: z.string().min(1).max(256), email: z.string().optional(), email_verified: z.union([z.boolean(), z.literal('true'), z.literal('false')]).optional(), name: z.string().max(160).optional() }).passthrough().parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
      const issuerValid = provider === 'google' ? ['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) : claims.iss === 'https://appleid.apple.com';
      const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud], now = Math.floor(this.now() / 1000);
      if (!issuerValid || !audiences.includes(clientId) || audiences.length > 1 && claims.azp !== clientId || claims.azp !== undefined && claims.azp !== clientId ||
          claims.exp <= now || claims.iat > now + 60 || claims.iat > claims.exp || claims.exp - claims.iat > 86400 || (claims.nbf ?? 0) > now + 60 || digestAuth(claims.nonce) !== nonceHash) throw new AuthError('AUTH_INVALID_ID_TOKEN');
      const email = emailSchema.safeParse(claims.email), name = claims.name?.trim();
      return { subject: claims.sub, ...(email.success ? { email: email.data } : {}), emailVerified: claims.email_verified === true || claims.email_verified === 'true', ...(name && !/[\x00-\x1f\x7f]/.test(name) ? { name } : {}) };
    } catch (error) { throw error instanceof AuthError ? error : new AuthError('AUTH_INVALID_ID_TOKEN'); }
  }
}
export function appleClientSecret(config: { clientId: string; teamId?: string; keyId?: string; privateKey?: KeyObject }, now: number) {
  const head = Buffer.from(JSON.stringify({ alg: 'ES256', kid: config.keyId })).toString('base64url');
  const issued = Math.floor(now / 1000), body = Buffer.from(JSON.stringify({ iss: config.teamId, iat: issued, exp: issued + 300, aud: 'https://appleid.apple.com', sub: config.clientId })).toString('base64url');
  const data = `${head}.${body}`;
  return `${data}.${sign('sha256', Buffer.from(data), { key: config.privateKey!, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
