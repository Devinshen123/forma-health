import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { cloudProviderSchema, cloudProviders, emptyBodySchema, HealthError, providerSchema } from './model';
import { HealthService, oauthCookieName, oauthCookiePath } from './service';

const sessionCookie = 'forma_session';
export function healthRouter(service: HealthService, auth: RequestHandler, secureCookies: boolean) {
  const router = Router(); router.use(auth);
  router.get('/connections', (_req, res) => res.json(service.connections(res.locals.account.id)));
  router.get('/records', (req, res) => {
    const input = z.object({ provider: providerSchema.optional(), limit: z.coerce.number().int().min(1).max(500).default(100), cursor: z.string().max(300).regex(/^[^\x00-\x1f\x7f]*$/).default('') }).strict().parse(req.query);
    res.json(service.ledger.records(res.locals.account.id, input.provider, input.limit, input.cursor));
  });
  router.post('/:provider/connect', (req, res) => {
    const provider = cloudProviderSchema.parse(req.params.provider); emptyBodySchema.parse(req.body);
    const result = service.beginConnect(res.locals.account.id, req.cookies[sessionCookie], provider);
    res.cookie(oauthCookieName(provider), result.binding, { httpOnly: true, secure: secureCookies, sameSite: 'lax', path: oauthCookiePath(provider), maxAge: 10 * 60000 });
    res.json({ authorizationUrl: result.authorizationUrl });
  });
  router.post('/:provider/sync', async (req, res) => {
    const provider = cloudProviderSchema.parse(req.params.provider); emptyBodySchema.parse(req.body);
    res.json(await service.sync(res.locals.account.id, provider));
  });
  router.post('/:provider/disconnect', (req, res) => {
    const provider = providerSchema.parse(req.params.provider); emptyBodySchema.parse(req.body);
    if (provider !== 'apple-health') res.clearCookie(oauthCookieName(provider), { httpOnly: true, secure: secureCookies, sameSite: 'lax', path: oauthCookiePath(provider) });
    res.json(service.disconnect(res.locals.account.id, provider));
  });
  router.delete('/:provider/records', (req, res) => {
    const provider = providerSchema.parse(req.params.provider); z.object({ confirm: z.literal(true) }).strict().parse(req.body);
    res.json(service.deleteRecords(res.locals.account.id, provider));
  });
  router.post('/apple-health/import', (req, res) => res.json(service.importApple(res.locals.account.id, req.body)));
  return router;
}
export function healthCallbackRouter(service: HealthService, secureCookies: boolean) {
  const router = Router();
  router.get('/:provider/callback', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Security-Policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const provider = cloudProviderSchema.parse(req.params.provider);
      const query = z.object({ state: z.string().regex(/^[a-f0-9]{64}$/), code: z.string().min(1).max(4096).regex(/^[\x21-\x7e]+$/).optional(), error: z.string().min(1).max(160).optional() }).passthrough().parse(req.query);
      const binding = req.cookies?.[oauthCookieName(provider)], session = req.cookies?.[sessionCookie];
      if (typeof binding !== 'string' || !/^[a-f0-9]{64}$/.test(binding) || session !== undefined && (typeof session !== 'string' || !/^[a-f0-9]{64}$/.test(session))) throw new HealthError('HEALTH_OAUTH_INVALID', 400);
      res.clearCookie(oauthCookieName(provider), { httpOnly: true, secure: secureCookies, sameSite: 'lax', path: oauthCookiePath(provider) });
      await service.callback(provider, query, binding, session);
      res.type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><title>Forma · Health connected</title><h1>Health account connected</h1><p>Return to Forma settings to sync and review imported records.</p><a href="/">Open Forma</a></html>');
    } catch (error) {
      const status = error instanceof HealthError ? error.status : 400;
      res.status(status).type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><title>Forma · Connection incomplete</title><h1>Connection incomplete</h1><p>The authorization was denied, expired, or could not be verified. Return to Forma and start a new connection.</p><a href="/">Open Forma</a></html>');
    }
  });
  return router;
}
export function clearHealthCallbackCookies(res: Parameters<RequestHandler>[1], secureCookies: boolean) {
  for (const provider of cloudProviders) res.clearCookie(oauthCookieName(provider), { httpOnly: true, secure: secureCookies, sameSite: 'lax', path: oauthCookiePath(provider) });
}
