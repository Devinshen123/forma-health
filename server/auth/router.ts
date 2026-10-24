import { Router, type Request, type Response, type RequestHandler } from 'express';
import { z } from 'zod';
import type { Account } from '../store';
import type { User } from '../../src/types';
import { AuthError, authTokenSchema, emailSchema, newPasswordSchema, providerSchema } from './config';
import { AUTH_BROWSER_COOKIE, AUTH_BROWSER_PATH, AuthService } from './service';

export interface AuthRouteContext {
  auth: RequestHandler; rateLimit: RequestHandler; secureCookies: boolean;
  sessionOf: (req: Request) => { token: string; account: Account | undefined } | null;
  issueSession: (req: Request, res: Response, user: User) => void;
  cancelHealth: (owner: string) => void;
}
const publicUser = ({ id, email, name }: User): User => ({ id, email, name });
export function clearAuthBrowserCookie(res: Response, secure: boolean) { res.clearCookie(AUTH_BROWSER_COOKIE, { httpOnly: true, sameSite: 'strict', secure, path: AUTH_BROWSER_PATH }); }
export function authRouter(service: AuthService, context: AuthRouteContext) {
  const router = Router(), empty = z.object({}).strict();
  router.get('/options', (_req, res) => res.json(service.options()));
  router.get('/account', context.auth, (_req, res) => res.json(service.security(res.locals.account.id)));
  router.post('/forgot-password', context.rateLimit, (req, res) => { const input = z.object({ email: emailSchema }).strict().parse(req.body); res.status(202).json(service.forgot(input.email)); });
  router.post('/send-verification', context.auth, context.rateLimit, (req, res) => {
    empty.parse(req.body); res.status(202).json(service.sendVerification(res.locals.account.id, context.sessionOf(req)!.token));
  });
  router.post('/verify-email', context.rateLimit, (req, res) => { const { token } = z.object({ token: authTokenSchema }).strict().parse(req.body); res.json(service.verifyEmail(token)); });
  router.post('/reset-password', context.rateLimit, async (req, res) => {
    const { token, password } = z.object({ token: authTokenSchema, password: newPasswordSchema }).strict().parse(req.body);
    const current = context.sessionOf(req), owner = await service.resetPassword(token, password);
    context.cancelHealth(owner);
    if (current?.account?.id === owner) { res.clearCookie('forma_session', { httpOnly: true, sameSite: 'strict', secure: context.secureCookies, path: '/' }); clearAuthBrowserCookie(res, context.secureCookies); }
    res.json({ ok: true });
  });
  router.post('/password', context.auth, context.rateLimit, async (req, res) => {
    const { currentPassword, password } = z.object({ currentPassword: z.string().min(1).max(128).optional(), password: newPasswordSchema }).strict().parse(req.body);
    const owner = res.locals.account.id, session = context.sessionOf(req)!.token;
    const account = await service.changePassword(owner, session, password, currentPassword);
    context.cancelHealth(owner); context.issueSession(req, res, account); res.json({ user: publicUser(account) });
  });
  router.post('/:provider/start', context.rateLimit, async (req, res) => {
    const provider = providerSchema.parse(req.params.provider), input = z.object({ intent: z.enum(['login', 'link']), password: z.string().min(1).max(128).optional() }).strict().parse(req.body);
    const current = context.sessionOf(req), session = current?.account ? { token: current.token, owner: current.account.id } : undefined;
    if (input.intent === 'link' && (!session || req.get('X-Forma-Account') !== session.owner)) throw new AuthError('AUTH_SESSION_CHANGED', 401);
    const result = await service.start(provider, input.intent, session, input.password);
    res.cookie(AUTH_BROWSER_COOKIE, result.binding, { httpOnly: true, sameSite: 'strict', secure: context.secureCookies, path: AUTH_BROWSER_PATH, maxAge: 10 * 60000 });
    res.json({ authorizationUrl: result.authorizationUrl });
  });
  router.post('/oauth/complete', context.rateLimit, (req, res) => {
    const { ticket } = z.object({ ticket: authTokenSchema }).strict().parse(req.body), binding = authTokenSchema.safeParse(req.cookies?.[AUTH_BROWSER_COOKIE]);
    if (!binding.success) throw new AuthError('AUTH_INVALID_STATE');
    const current = context.sessionOf(req), user = service.complete(ticket, binding.data, current?.account ? current.token : undefined);
    context.issueSession(req, res, user); res.json({ user });
  });
  return router;
}
export function authCallbackRouter(service: AuthService) {
  const router = Router();
  const callback: RequestHandler = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Security-Policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const provider = providerSchema.parse(req.params.provider);
      if (provider === 'apple' && req.method !== 'POST' || provider === 'google' && req.method !== 'GET') throw new AuthError('AUTH_INVALID_STATE');
      const input = z.object({ state: authTokenSchema, code: z.string().min(1).max(4096).regex(/^[\x21-\x7e]+$/).optional(), error: z.string().min(1).max(200).optional() }).passthrough().parse(req.method === 'POST' ? req.body : req.query);
      const ticket = await service.callback(provider, input.state, input.code, input.error !== undefined);
      res.redirect(303, service.resultUrl('oauth', ticket));
    } catch (error) {
      const allowed = ['AUTH_CONSENT_DENIED', 'AUTH_PROVIDER_NOT_CONFIGURED', 'AUTH_PROVIDER_TIMEOUT', 'AUTH_PROVIDER_UNAVAILABLE', 'AUTH_INVALID_ID_TOKEN', 'AUTH_SESSION_CHANGED'];
      const code = error instanceof AuthError && allowed.includes(error.code) ? error.code : 'AUTH_INVALID_STATE';
      res.redirect(303, service.resultUrl('error', code));
    }
  };
  router.get('/:provider', callback); router.post('/:provider', callback); return router;
}
