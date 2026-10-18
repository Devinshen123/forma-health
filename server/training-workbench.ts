import express, { type RequestHandler, type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Store } from './store';
import { workoutSchema } from './training-validation';
import { projectWorkbenchWorkouts } from './training-workbench-projection';
import { WorkbenchError, WORKBENCH_JSON_BYTES, parseWorkbenchWrite, workbenchHashSchema, workbenchMediaLimit, workbenchMediaMagic, workbenchMediaTypes, validateWorkbenchImage, type WorkbenchMediaMime } from './training-workbench-data';

/** Adapt the licensed training client to Forma's existing session; no separate auth provider. */
export function trainingWorkbenchRouter(store: Store, auth: RequestHandler, secureCookies: boolean, localOrigins: ReadonlySet<string>) {
  const router = express.Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use((req, res, next) => {
    const safe = ['GET', 'HEAD', 'OPTIONS'].includes(req.method), origin = req.get('origin');
    const sameHttpsOrigin = secureCookies && req.secure && origin === `https://${req.get('host')}`;
    if ((origin && !localOrigins.has(origin) && !sameHttpsOrigin) || (!safe && (!origin || (!localOrigins.has(origin) && !sameHttpsOrigin))) || req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'A trusted request origin is required' });
    if (!safe && !(req.method === 'PUT' && /^\/media\/[^/]+\/?$/i.test(req.path)) && !req.is('application/json')) return res.status(415).json({ error: 'Use application/json' });
    next();
  });
  router.use(cookieParser(), auth);
  router.use((req, res, next) => req.method === 'PUT' && /^\/media\/[^/]+\/?$/i.test(req.path) ? next() : express.json({ limit: WORKBENCH_JSON_BYTES, strict: true })(req, res, next));
  router.get('/me', (_req, res) => {
    const account = res.locals.account;
    res.json({ user: { id: account.id, name: account.name, admin: false }, auth: 'forma' });
  });
  router.get('/config', (_req, res) => res.json({
    invite_only: true, allow_guest: false, password_login: false, default_lang: 'zh',
    registration: false, device_link: false, remote: false, health: false, coach: null,
    media: { imageMB: 2, gifMB: 8, videoMB: 40, videoSec: 60, quotaMB: 200, workouts: true },
  }));
  router.get('/data', (_req, res) => res.json(store.workbenchSnapshot(res.locals.account.id)));
  router.get('/data/rev', (_req, res) => {
    const { rev, wid } = store.workbenchSnapshot(res.locals.account.id);
    res.json({ rev, ...(wid ? { wid } : {}) });
  });
  router.put('/data', (req, res) => {
    const write = parseWorkbenchWrite(req.body), ownerId: string = res.locals.account.id;
    let projection;
    try { projection = projectWorkbenchWorkouts(write.state, ownerId); }
    catch { throw new WorkbenchError(400, 'Invalid training workbench data'); }
    // The raw document remains independent; only the bounded deterministic projection enters Forma.
    workoutSchema.array().max(10000).parse(projection.workouts);
    res.json(store.saveWorkbench(ownerId, write, projection));
  });
  router.post('/media/missing', (req, res) => {
    const { hashes } = z.object({ hashes: z.array(workbenchHashSchema).max(1000) }).strict().parse(req.body);
    const ownerId: string = res.locals.account.id;
    res.json({ missing: [...new Set(hashes)].filter(hash => !store.workbenchMediaAvailable(ownerId, hash)), usage: store.workbenchMediaUsage(ownerId) });
  });
  router.put('/media/:hash', (req, res, next) => {
    if (!workbenchMediaTypes.includes(req.get('content-type') as WorkbenchMediaMime)) return res.status(415).json({ error: 'Unsupported training media type', code: 'media-type' });
    const announced = Number(req.get('content-length'));
    if (Number.isFinite(announced) && announced > workbenchMediaLimit(req.get('content-type') as WorkbenchMediaMime)) return res.status(413).json({ error: 'Training media is too large', code: 'media-too-large' });
    next();
  }, (req, res, next) => express.raw({ type: () => true, limit: workbenchMediaLimit(req.get('content-type') as WorkbenchMediaMime) })(req, res, next), async (req, res) => {
    const parsed = workbenchHashSchema.safeParse(req.params.hash);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid training media address', code: 'media-invalid' });
    const mime = req.get('content-type') as WorkbenchMediaMime, bytes = req.body;
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > workbenchMediaLimit(mime)) return res.status(413).json({ error: 'Training media is too large', code: 'media-too-large' });
    if (!workbenchMediaMagic(bytes, mime) || createHash('sha256').update(bytes).digest('hex') !== parsed.data || !await validateWorkbenchImage(bytes, mime)) return res.status(400).json({ error: 'Training media content is invalid', code: 'media-invalid' });
    const result = store.addWorkbenchMedia(res.locals.account.id, parsed.data, mime, bytes);
    res.status(result.existed ? 200 : 201).json(result);
  });
  router.get('/media/:hash', (req, res) => {
    const parsed = workbenchHashSchema.safeParse(req.params.hash);
    const media = parsed.success ? store.workbenchMedia(res.locals.account.id, parsed.data) : undefined;
    if (!media) return res.status(404).json({ error: 'Training media is not available', code: 'media-missing' });
    const bytes = store.workbenchMediaBytes(media);
    res.setHeader('Content-Type', media.mime);
    res.setHeader('Content-Disposition', 'inline; filename="training-media"');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    res.setHeader('Accept-Ranges', 'bytes');
    const range = req.get('range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start = match?.[1] ? Number(match[1]) : match?.[2] ? Math.max(0, bytes.length - Number(match[2])) : NaN;
      let end = match?.[1] ? match[2] ? Number(match[2]) : bytes.length - 1 : bytes.length - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= bytes.length || end < start || (!match?.[1] && Number(match?.[2]) === 0)) { res.setHeader('Content-Range', `bytes */${bytes.length}`); return res.status(416).end(); }
      end = Math.min(end, bytes.length - 1);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${bytes.length}`);
      res.setHeader('Content-Length', end - start + 1);
      return res.status(206).send(bytes.subarray(start, end + 1));
    }
    res.setHeader('Content-Length', bytes.length);
    res.send(bytes);
  });
  router.post('/media/sweep', (req, res) => {
    z.object({}).strict().parse(req.body);
    res.json(store.sweepWorkbenchMedia(res.locals.account.id));
  });
  router.get('/export', (_req, res) => { res.setHeader('Content-Disposition', 'attachment; filename="forma-training-workbench.json"'); res.json(store.exportWorkbench(res.locals.account.id)); });
  router.use((_req, res) => res.status(404).json({ error: 'Training endpoint not found' }));
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if ((error as { type?: string }).type === 'entity.too.large') return res.status(413).json({ error: 'Training upload is too large', code: req.method === 'PUT' && /^\/media\//i.test(req.path) ? 'media-too-large' : 'workbench-too-large' });
    next(error);
  });
  return router;
}
