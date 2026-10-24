import { createPrivateKey, type KeyObject } from 'node:crypto';
import { z } from 'zod';
import type { SignInProvider } from '../../src/auth';

export interface AuthConfig {
  publicBaseUrl?: string;
  google?: { clientId: string; clientSecret: string };
  apple?: { clientId: string; teamId: string; keyId: string; privateKey: string };
  resend?: { apiKey: string; from: string };
  timeoutMs?: number;
}
export interface AuthMail { to: string; subject: string; text: string }
export type AuthMailer = (message: AuthMail) => Promise<void>;
export class AuthError extends Error {
  constructor(readonly code: string, readonly status = 400) { super('Authentication could not complete this request'); }
}
export const providerSchema = z.enum(['google', 'apple']);
export const authTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const emailSchema = z.string().trim().email().max(254).transform(value => value.toLowerCase());
export const newPasswordSchema = z.string().min(10).max(128);
const secret = z.string().min(1).max(4096).regex(/^[\x21-\x7e]+$/);
export const endpoints = {
  google: { authorization: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', jwks: 'https://www.googleapis.com/oauth2/v3/certs' },
  apple: { authorization: 'https://appleid.apple.com/auth/authorize', token: 'https://appleid.apple.com/auth/token', jwks: 'https://appleid.apple.com/auth/keys' },
} as const;
export function resolveAuthConfig(overrides?: AuthConfig) {
  const config: AuthConfig = overrides ?? {
    publicBaseUrl: process.env.FORMA_AUTH_PUBLIC_BASE_URL,
    google: { clientId: process.env.FORMA_AUTH_GOOGLE_CLIENT_ID ?? '', clientSecret: process.env.FORMA_AUTH_GOOGLE_CLIENT_SECRET ?? '' },
    apple: { clientId: process.env.FORMA_AUTH_APPLE_CLIENT_ID ?? '', teamId: process.env.FORMA_AUTH_APPLE_TEAM_ID ?? '', keyId: process.env.FORMA_AUTH_APPLE_KEY_ID ?? '', privateKey: (process.env.FORMA_AUTH_APPLE_PRIVATE_KEY ?? '').replaceAll('\\n', '\n') },
    resend: { apiKey: process.env.FORMA_AUTH_RESEND_API_KEY ?? '', from: process.env.FORMA_AUTH_MAIL_FROM ?? '' },
  };
  let baseUrl: string | null = null;
  try {
    const url = new URL(config.publicBaseUrl || 'http://127.0.0.1:3001');
    if (url.username || url.password || url.pathname !== '/' || url.hash || url.search ||
        url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error();
    baseUrl = url.origin;
  } catch { /* Public options report invalid configuration without crashing startup. */ }
  const google = z.object({ clientId: secret, clientSecret: secret }).strict().safeParse(config.google);
  const apple = z.object({ clientId: secret, teamId: z.string().regex(/^[A-Za-z0-9]{1,64}$/), keyId: z.string().regex(/^[A-Za-z0-9]{1,64}$/), privateKey: z.string().min(1).max(10000) }).strict().safeParse(config.apple);
  let appleKey: KeyObject | undefined;
  if (apple.success) try {
    appleKey = createPrivateKey(apple.data.privateKey);
    if (appleKey.asymmetricKeyType !== 'ec' || appleKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') appleKey = undefined;
  } catch { /* Invalid PEM disables only Apple sign-in. */ }
  const from = config.resend?.from;
  const resend = config.resend && secret.safeParse(config.resend.apiKey).success && typeof from === 'string' && from.length <= 254 && !/[\r\n]/.test(from) &&
    (/^[^<>]+<[^<>]+>$/.test(from) ? emailSchema.safeParse(from.slice(from.indexOf('<') + 1, -1)).success : emailSchema.safeParse(from).success) ? config.resend : undefined;
  const timeout = z.number().int().min(10).max(30000).safeParse(config.timeoutMs ?? 10000);
  const providers: Partial<Record<SignInProvider, { clientId: string; clientSecret?: string; teamId?: string; keyId?: string; privateKey?: KeyObject }>> = {};
  if (google.success && baseUrl && timeout.success) providers.google = google.data;
  if (apple.success && appleKey && baseUrl?.startsWith('https://') && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname) && timeout.success)
    providers.apple = { clientId: apple.data.clientId, teamId: apple.data.teamId, keyId: apple.data.keyId, privateKey: appleKey };
  return { baseUrl, providers, resend, timeoutMs: timeout.success ? timeout.data : 10000,
    reasons: Object.fromEntries((['google', 'apple'] as const).map(provider => [provider, providers[provider] ? 'ready' :
      config[provider] && Object.values(config[provider]!).some(Boolean) ? 'invalid_configuration' : 'not_configured'])) as Record<SignInProvider, 'ready' | 'not_configured' | 'invalid_configuration'> };
}
