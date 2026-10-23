import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { createApp, type AppOptions } from './app';
import { FOOD_PHOTO_MODEL } from './food-photo';

const RAW_DRAFT = { isFood: true, name: 'Rice', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, serving_size_grams: 100, ingredients: [], warnings: [] };
const envelope = () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(RAW_DRAFT) }] }] });
async function fixture(t: TestContext, extras: Pick<AppOptions, 'ai' | 'aiFetch' | 'aiNow'>) {
  const dir = mkdtempSync(join(tmpdir(), 'forma-food-photo-'));
  const service = createApp({ dataDir: dir, secureCookies: false, ...extras });
  const server = service.app.listen(0, '127.0.0.1');
  await new Promise<void>(ready => server.once('listening', ready));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir())) && dir.includes('forma-food-photo-'));
    rmSync(dir, { recursive: true, force: true });
  });
  const request = async (path: string, body?: unknown, owner?: { id: string; cookie: string }) => {
    const response = await fetch(`${origin}/api${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173', ...(owner ? { Cookie: owner.cookie, 'X-Forma-Account': owner.id } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const account = async (email: string) => {
    const response = await request('/auth/register', { email, password: 'fixture-password-12345', name: 'Fixture account' });
    assert.equal(response.status, 201); const cookie = response.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
    return { id: response.body.user.id as string, cookie };
  };
  const upload = async (owner: { id: string; cookie: string }) => {
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer();
    const response = await request('/assets', { name: 'fixture.png', mime: 'image/png', base64: image.toString('base64') }, owner);
    assert.equal(response.status, 201); return response.body.id as string;
  };
  return { service, request, account, upload };
}

test('oversized raw provider HTTP bodies are cancelled, sanitized, charged once and never retried', async t => {
  let calls = 0, cancelled = false;
  const h = await fixture(t, { ai: { apiKey: 'fixture-only', retryDelayMs: 0 }, aiFetch: async () => {
    calls++;
    return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Length': String(128 * 1024 + 1) } });
  } });
  const owner = await h.account('bounded@example.com'), assetId = await h.upload(owner);
  const response = await h.request('/food-photo-drafts', { assetId, consent: true, language: 'en' }, owner);
  assert.equal(response.status, 502); assert.equal(response.body.code, 'AI_INVALID_OUTPUT'); assert.equal(calls, 1); assert.equal(cancelled, true);
  assert.deepEqual(h.service.store.aiDrafts(owner.id), []);
  assert.deepEqual(h.service.store.aiUsage(owner.id).map(usage => ({ attempts: usage.attempts, reservedUsd: usage.reservedUsd })), [{ attempts: 1, reservedUsd: 0.02 }]);
});

test('concurrent accounts atomically share the project reservation ceiling before transport starts', async t => {
  let calls = 0;
  const h = await fixture(t, { ai: { apiKey: 'fixture-only', globalDailyReservedUsdLimit: 0.02, retryDelayMs: 0 }, aiNow: () => Date.parse('2026-10-14T19:00:00Z'), aiFetch: async (input, init) => {
    calls++; assert.equal(String(input), 'https://api.openai.com/v1/responses');
    assert.equal(JSON.parse(String(init?.body)).model, FOOD_PHOTO_MODEL);
    return new Response(JSON.stringify(envelope()), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } });
  const a = await h.account('global-a@example.com'), b = await h.account('global-b@example.com');
  const aAsset = await h.upload(a), bAsset = await h.upload(b);
  const responses = await Promise.all([h.request('/food-photo-drafts', { assetId: aAsset, consent: true, language: 'en' }, a), h.request('/food-photo-drafts', { assetId: bAsset, consent: true, language: 'en' }, b)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 429]);
  assert.equal(responses.find(response => response.status === 429)?.body.code, 'AI_BUDGET_LIMIT'); assert.equal(calls, 1);
  assert.equal(h.service.store.aiReservations(a.id).length + h.service.store.aiReservations(b.id).length, 1);
});
