import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { COMPANION_ITEMS } from '../src/companion';
import { idSchema } from './validation-primitives';
import type { Store } from './store';

const empty = z.object({}).strict();
const equipment = z.object({ item: z.enum(COMPANION_ITEMS).nullable() }).strict();
const challenge = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create') }).strict(),
  z.object({ action: z.literal('leave') }).strict(),
  z.object({ action: z.literal('join'), code: z.string().trim().toUpperCase().regex(/^[0-9A-F]{16}$/) }).strict(),
]);
export function companionRouter(store: Store, auth: RequestHandler) {
  const router = Router(); router.use(auth);
  router.get('/', (_req, res) => res.json(store.companionSnapshot(res.locals.account.id)));
  router.post('/claim', (req, res) => { empty.parse(req.body); res.json(store.claimCompanion(res.locals.account.id)); });
  router.post('/rest', (req, res) => { empty.parse(req.body); res.json(store.claimCompanion(res.locals.account.id, true)); });
  router.post('/chests/:id/open', (req, res) => { empty.parse(req.body); res.json(store.openCompanionChest(res.locals.account.id, idSchema.parse(req.params.id))); });
  router.put('/equipment', (req, res) => { const { item } = equipment.parse(req.body); res.json(store.equipCompanion(res.locals.account.id, item)); });
  router.post('/challenges', (req, res) => {
    const input = challenge.parse(req.body);
    res.json(store.companionChallenge(res.locals.account.id, input.action, input.action === 'join' ? input.code : undefined));
  });
  return router;
}
