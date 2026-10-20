import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createApp } from '../../server/app';
import type { CompanionSnapshot } from '../../src/companion';
import type { SyncSnapshot, User } from '../../src/types';

// This fixture never launches a browser. The lead starts it after releasing 5173,
// then uses the existing CUA in-app browser for actual keyboard/touch interactions.
assert.ok(process.argv.includes('--serve-only'), 'Use --serve-only; browser operation belongs to the lead');
assert.ok(process.env.FORMA_TEST_OUTPUT, 'Set FORMA_TEST_OUTPUT to an external synthetic evidence directory');
const root = resolve(import.meta.dirname, '../..');
const output = resolve(process.env.FORMA_TEST_OUTPUT!);
const evidenceRelative = relative(root, output);
assert.ok(evidenceRelative.startsWith('..') || isAbsolute(evidenceRelative), 'Synthetic evidence must stay outside the repository');
await mkdir(output, { recursive: true });
const base = 'http://127.0.0.1:5173';
const initial = new Date();
// Keep actual host time and timezone for manual forms. Only seeding visits earlier days.
const present = initial.getTime();
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const localDay = (time: number) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(time));
let now = present;
const service = createApp({ dataDir: join(output, 'synthetic-' + randomUUID()), distDir: join(root, 'dist'), secureCookies: false, ai: {}, companionNow: () => now });
const server = service.app.listen(5173, '127.0.0.1');
await new Promise<void>((ready, reject) => { server.once('listening', ready); server.once('error', reject); });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
  service.close();
}
process.once('SIGINT', () => { void close(); });
process.once('SIGTERM', () => { void close(); });
const password = 'Synthetic companion QA password 2026';
type SyntheticAccount = { user: User; cookie: string; email: string };
async function request<T>(path: string, account?: SyntheticAccount, body?: unknown, method?: string) {
  const response = await fetch(base + path, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers: { Origin: base, 'Content-Type': 'application/json', ...(account ? { Cookie: account.cookie, 'X-Forma-Account': account.user.id } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.equal(response.status, path.endsWith('/register') ? 201 : 200, `Synthetic fixture API: ${path}`);
  return { data: await response.json() as T, response };
}
async function register(email: string, name: string): Promise<SyntheticAccount> {
  const result = await request<{ user: User }>('/api/auth/register', undefined, { name, email, password });
  const cookie = result.response.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  const account = { user: result.data.user, cookie, email };
  await request('/api/sync', account, { mutationId: randomUUID(), changes: [{ collection: 'profile', id: 'profile', kind: 'upsert', baseVersion: 0, value: { name, goal: 'habits', experience: 'regular', trainingDays: 3, timeMinutes: 30, equipment: 'gym', allergies: '', restrictions: '', language: 'en', units: 'metric', timezone, sleepGoal: 8, cloudConsent: false, aiConsent: false } }] });
  return account;
}

try {
  const fresh = await register('companion-fresh@example.test', 'Synthetic fresh companion');
  const grown = await register('companion-qa@example.test', 'Synthetic grown companion');
  const friend = await register('companion-friend@example.test', 'Synthetic friend companion');
  for (let offset = 5; offset >= 0; offset--) {
    now = present - offset * 86400000;
    const date = localDay(now), mealId = randomUUID();
    await request('/api/sync', grown, { mutationId: randomUUID(), changes: [{ collection: 'meals', id: mealId, kind: 'upsert', baseVersion: 0, value: { id: mealId, date, name: 'Synthetic companion seed meal', type: 'lunch', grams: 100, referenceGrams: 100, kcal: 200, protein: 10, carbs: 25, fat: 5, source: 'manual', createdAt: new Date(now).toISOString() } }] });
    await request('/api/companion/rest', grown, {});
    const id = randomUUID();
    await request('/api/sync', grown, { mutationId: randomUUID(), changes: [{ collection: 'sleeps', id, kind: 'upsert', baseVersion: 0, value: { id, date, start: new Date(now - 7 * 3600000).toISOString(), end: new Date(now).toISOString(), timezone, quality: 3, energy: 3, source: 'manual', createdAt: new Date(now).toISOString() } }] });
  }
  now = present;
  const grownSnapshot = (await request<CompanionSnapshot>('/api/companion', grown)).data;
  const freshSnapshot = (await request<CompanionSnapshot>('/api/companion', fresh)).data;
  assert.equal(grownSnapshot.xp, 180); assert.equal(grownSnapshot.activeDays, 6); assert.equal(grownSnapshot.chests.length, 2);
  assert.equal(freshSnapshot.xp, 0);
  const accountData = [fresh, grown, friend].map(({ user, email }) => ({ id: user.id, email, password }));
  const clock = { serverUTC: new Date(present).toISOString(), hostLocal: new Date(present).toString(), profileTimezone: timezone, profileDay: localDay(present), rewardDayUTC: freshSnapshot.day };
  await writeFile(join(output, 'synthetic-accounts.json'), JSON.stringify({ base, clock, accounts: accountData, expected: { fresh: { xp: 0, activeDays: 0 }, grown: { xp: 180, level: 2, activeDays: 6, unopenedChests: 2 } } }, null, 2));
  const sync = (await request<SyncSnapshot>('/api/sync', grown)).data;
  assert.equal(sync.state.meals.length, 6); assert.equal(sync.state.sleeps.length, 6);
  console.log('Synthetic companion fixture ready at ' + base);
  for (const account of accountData) console.log('Synthetic login: ' + account.email + ' / ' + account.password);
  console.log('Fixture clock: ' + JSON.stringify(clock) + '; evidence: ' + output);
  console.log('CUA checks: demo has no private requests; fresh 0; real meal/rest/sleep rewards once; grown chest/equipment; invite/join/leave; account switch; bilingual; keyboard; 390px; reduced motion; offline retry. Mask health img/video in any saved screenshots.');
} catch (error) {
  await close();
  throw error;
}
