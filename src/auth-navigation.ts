import type {SignInProvider} from './auth';

/** Official fixed providers, or the exact authorization endpoint from trusted same-origin options. */
export function validateSignInDestination(authorizationUrl: string, provider: SignInProvider, casdoorEndpoint?: string): string {
  const url = new URL(authorizationUrl);
  if (provider === 'casdoor') {
    const endpoint = new URL(casdoorEndpoint || 'about:blank');
    const validProtocol = endpoint.protocol === 'https:' || endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
    if (!validProtocol || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/login/oauth/authorize' ||
        url.origin !== endpoint.origin || url.pathname !== endpoint.pathname || url.username || url.password || url.hash) throw new Error('Invalid authorization destination');
    return url.href;
  }
  if (url.protocol !== 'https:' || url.username || url.password ||
    (url.port !== '' && url.port !== '443') || url.hash ||
    url.hostname !== (provider === 'google' ? 'accounts.google.com' : 'appleid.apple.com') ||
    url.pathname !== (provider === 'google' ? '/o/oauth2/v2/auth' : '/auth/authorize')) throw new Error('Invalid authorization destination');
  return url.href;
}
