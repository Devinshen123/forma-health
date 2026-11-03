export type SignInProvider = 'google' | 'apple' | 'casdoor';
export interface AuthOptions {
  email: { available: true; mailAvailable: boolean };
  providers: Record<SignInProvider, { available: boolean; reason: 'ready' | 'not_configured' | 'invalid_configuration'; authorizationEndpoint?: string }>;
}
export interface AccountSecurity {
  emailVerified: boolean;
  hasPassword: boolean;
  providers: SignInProvider[];
  mailAvailable: boolean;
}
export type AuthEntry = { kind: 'reset' | 'verify'; token: string } | { kind: 'oauth'; ticket: string } | { kind: 'error'; code: string };
export interface AuthMailResult { ok: true; delivery: 'accepted' }
