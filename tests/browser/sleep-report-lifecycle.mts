import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../../server/app';

// Component integration harness: real Sleep/Reports, SyncEngine, API and SQLite.
// It deliberately does not import App/Training or replace the deleted catalog.
const repo = resolve(import.meta.dirname, '../..');
const require = createRequire(join(repo, 'package.json'));
const { createServer } = require('vite');
const { chromium, expect } = require('@playwright/test');
const output = process.env.FORMA_TEST_OUTPUT;
assert.ok(output, 'Set FORMA_TEST_OUTPUT to a dedicated synthetic evidence directory');
const out = resolve(output);
await mkdir(out, { recursive: true });
const fixture = createApp({ dataDir: join(out, 'synthetic-data-' + randomUUID()), secureCookies: false, ai: {} });
const apiServer: Server = await new Promise((done, reject) => { const s = fixture.app.listen(0, '127.0.0.1', () => done(s)); s.once('error', reject); });
const address = apiServer.address();
assert.ok(address && typeof address !== 'string');
const apiBase = `http://127.0.0.1:${address.port}`;
const entry = '/__forma_lifecycle.tsx';
const harness = `
import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import Sleep from '/src/features/Sleep.tsx';
import Reports from '/src/features/Reports.tsx';
import {SyncEngine} from '/src/sync/engine.ts';
import * as api from '/src/api.ts';
import '/src/styles.css';
function Harness() {
  const [view, setView] = useState(null), [kind, setKind] = useState('sleeps');
  const engineRef = useRef(null), [message, setMessage] = useState('');
  async function boot() {
    if(engineRef.current) await engineRef.current.stop();
    const {user}=await api.getMe(); api.setAccountHint(user.id);
    const snapshot=await api.getSync(user.id);
    const engine = new SyncEngine(user, snapshot, (state,status)=>setView({state,status,engine}));
    engineRef.current=engine; await engine.restore();
  }
  useEffect(()=>{void boot(); return()=>{void engineRef.current?.stop();};},[]);
  if(!view)return <p>Loading synthetic fixture</p>;
  const {engine,state,status}=view, context=engine.context();
  const save=async next=>{if(engineRef.current!==engine)throw Error('Account changed'); await engine.save(next,context);};
  const Feature=kind==='sleeps'?Sleep:Reports;
  return <main style={{maxWidth:1000,margin:'20px auto'}}>
    <p>Synthetic component integration fixture; full App is not mounted.</p>
    <nav aria-label="Fixture controls">
      <button onClick={()=>setKind('sleeps')}>Open sleep fixture</button>
      <button onClick={()=>setKind('reports')}>Open report fixture</button>
      <button onClick={()=>engine.refresh()}>Refresh synthetic records</button>
      <button onClick={()=>engine.refresh()}>Retry queued sync</button>
      <button onClick={()=>boot()}>Reload synthetic account</button>
    </nav>
    <p role="status" aria-label="Synthetic sync status">{status.busy?'busy':status.pending?'pending '+status.pending:'synced'}</p>
    <p aria-label="Synthetic notification">{message}</p>
    <Feature key={kind+engine.user.id} state={state} lang="en" save={save} notify={(zh,en)=>setMessage(en||zh)} demo={false} accountId={engine.user.id}/>
  </main>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
`;
let vite: any;
try {
vite = await createServer({ root: repo, configFile: false, cacheDir: join(out, 'vite-cache'),
  esbuild: { jsx: 'automatic' }, optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react'] },
  server: { host: '127.0.0.1', port: 0, proxy: { '/api': { target: apiBase,
    configure: (proxy: any) => proxy.on('proxyReq', (request: any) => request.setHeader('Origin', 'http://127.0.0.1:5173')) } } },
  plugins: [{ name: 'synthetic-sleep-report-fixture',
    resolveId(id: string) { if (id === entry) return id; },
    load(id: string) { if (id === entry) return harness; },
    configureServer(server: any) { server.middlewares.use(async (request: any, response: any, next: any) => {
      if (request.url !== '/') return next();
      response.setHeader('Content-Type', 'text/html');
      response.end(await server.transformIndexHtml('/', '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="' + entry + '"></script></body></html>'));
    }); },
  }],
});
await vite.listen();
} catch (error) {
  if (vite) await vite.close();
  await new Promise<void>(done => apiServer.close(() => done())); fixture.close();
  throw error;
}
const uiAddress = vite.httpServer.address();
assert.ok(uiAddress && typeof uiAddress !== 'string');
const base = `http://127.0.0.1:${uiAddress.port}`;
const tests: any[] = [], errors: string[] = [];
let browser: any;
const NOW = '2026-10-17T12:00:00.000Z';
const day = '2026-10-17';
const syntheticPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
const sleep = (patch = {}) => ({ id: randomUUID(), date: day, start: '2026-10-16T22:00:00.000Z', end: '2026-10-17T06:00:00.000Z', quality: 3, energy: 3, source: 'manual', timezone: 'Etc/UTC', createdAt: NOW, ...patch });
const report = (patch = {}) => ({ id: randomUUID(), date: day, name: 'Synthetic report', markers: [{ name: 'Synthetic marker', value: '10', unit: 'fixture', range: '5–15', notes: '' }], extractionStatus: 'manual', createdAt: NOW, ...patch });
async function http(ctx: any, method: string, path: string, id?: string, data?: any) {
  const response = await ctx.request.fetch(base + '/api' + path, { method, headers: { Origin: 'http://127.0.0.1:5173', ...(id ? { 'X-Forma-Account': id } : {}) }, ...(data === undefined ? {} : { data }) });
  assert.ok(response.ok(), method + ' ' + path + ': ' + response.status() + ' ' + await response.text());
  return response.json();
}
async function register(ctx: any) {
  return (await http(ctx, 'POST', '/auth/register', undefined, { email: `lifecycle-${randomUUID()}@example.test`, password: 'Synthetic-lifecycle-password-2026', name: 'Synthetic lifecycle account' })).user;
}
async function account(kind: string) {
  const ctx = await browser.newContext({ viewport: { width: process.env.FORMA_MOBILE ? 390 : 1280, height: 900 }, timezoneId: 'UTC' });
  await ctx.addInitScript(() => localStorage.setItem('forma-language', 'en'));
  await ctx.route('**/*', (route: any) => new URL(route.request().url()).origin === base || route.request().url().startsWith('blob:') ? route.continue() : route.abort());
  const user = await register(ctx);
  const snap = () => http(ctx, 'GET', '/sync', user.id);
  const mutate = async (collection: string, id: string, value: any) => {
    const s = await snap(); return http(ctx, 'POST', '/sync', user.id, { mutationId: randomUUID(), changes: [{ collection, id, baseVersion: s.entityVersions[collection + ':' + id] ?? 0, kind: value === undefined ? 'delete' : 'upsert', ...(value === undefined ? {} : { value }) }] });
  };
  const asset = kind === 'reports' ? await http(ctx, 'POST', '/assets', user.id, { name: 'synthetic-lifecycle.pdf', mime: 'application/pdf', base64: syntheticPdf.toString('base64') }) : null;
  const item = kind === 'sleeps' ? sleep() : report({ assetId: asset.id });
  await mutate(kind, item.id, item);
  const p = await ctx.newPage(); p.on('pageerror', (error: any) => errors.push(String(error)));
  await p.goto(base); await expect(p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('synced');
  if (kind === 'reports') await p.getByRole('button', { name: 'Open report fixture', exact: true }).click();
  else await p.getByLabel('Wake-up date', { exact: true }).fill(day);
  // Register the response listener before clicking to avoid races on a fast loopback server.
  const refreshNow = async () => { const response = p.waitForResponse((r: any) => r.url().endsWith('/api/sync') && r.request().method() === 'GET'); await p.getByRole('button', { name: 'Refresh synthetic records', exact: true }).click(); await response; await expect(p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('synced'); };
  return { ctx, p, user, item, snap, mutate, refresh: refreshNow };
}
async function openEdit(h: any, kind: string) {
  await h.p.getByRole('button', { name: kind === 'sleeps' ? 'Edit this sleep' : 'Edit Synthetic report', exact: true }).click();
  const dialog = h.p.getByRole('dialog');
  if (kind === 'sleeps') await dialog.getByLabel('Sleep quality (1–5)', { exact: true }).selectOption('5');
  else await dialog.getByLabel('Original value (including > or <)', { exact: true }).fill('11');
  return dialog;
}
const saveLabel = (kind: string) => kind === 'sleeps' ? 'Save sleep' : 'Review and save';
const deleteLabel = (kind: string) => kind === 'sleeps' ? 'Delete sleep' : 'Delete report';
const deleteOpen = (kind: string) => kind === 'sleeps' ? 'Delete this sleep' : 'Delete Synthetic report';
async function check(name: string, kind: string, run: (h: any) => Promise<any>) {
  if (process.env.FORMA_QA_MATCH && !new RegExp(process.env.FORMA_QA_MATCH).test(name)) return;
  const h = await account(kind);
  try { const evidence = await run(h); tests.push({ name, passed: true, evidence }); console.log('PASS ' + name); }
  catch (error: any) { await h.p.screenshot({ path: join(out, name + '.png'), animations: 'disabled' }); tests.push({ name, passed: false, error: String(error) }); console.log('FAIL ' + name + ': ' + error.message); }
  finally { await h.ctx.close(); }
}
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-gpu-compositing'] });
  for (const kind of ['sleeps', 'reports']) {
    for (const change of ['update', 'delete']) await check(kind + '-stale-edit-' + change, kind, async h => {
      const dialog = await openEdit(h, kind);
      // Keep deletion repro independent of the server's missing-asset validation.
      if (kind === 'reports' && change === 'delete') await dialog.getByRole('button', { name: 'Remove attachment', exact: true }).click();
      const remote = kind === 'sleeps' ? { ...h.item, quality: 2 } : { ...h.item, markers: [{ ...h.item.markers[0], value: '20' }] };
      await h.mutate(kind, h.item.id, change === 'delete' ? undefined : remote); await h.refresh();
      await dialog.getByRole('button', { name: saveLabel(kind), exact: true }).click();
      await h.p.waitForFunction(() => { const button = document.querySelector<HTMLButtonElement>('dialog button.btn-primary'); return !button || !button.disabled; });
      const actual = (await h.snap()).state[kind];
      assert.deepEqual(actual, change === 'delete' ? [] : [remote], 'old editor must preserve the remote correction or deletion');
      await expect(dialog.getByRole('alert')).toContainText('changed');
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).toHaveCount(0);
      return { remotePreserved: true, cancelSafe: true };
    });
    await check(kind + '-stale-delete-confirmation', kind, async h => {
      await h.p.getByRole('button', { name: deleteOpen(kind), exact: true }).click(); const dialog = h.p.getByRole('dialog');
      const remote = kind === 'sleeps' ? { ...h.item, energy: 2 } : { ...h.item, name: 'Newly reviewed report', markers: [{ ...h.item.markers[0], value: '20' }] };
      await h.mutate(kind, h.item.id, remote); await h.refresh();
      await dialog.getByRole('button', { name: deleteLabel(kind), exact: true }).click();
      await h.p.waitForFunction(() => { const button = document.querySelector<HTMLButtonElement>('dialog button.btn-primary'); return !button || !button.disabled; });
      assert.deepEqual((await h.snap()).state[kind], [remote], 'old confirmation must not delete the changed record');
      await expect(dialog.getByRole('alert')).toContainText('changed');
      await dialog.getByRole('button', { name: 'Keep', exact: true }).click(); await expect(dialog).toHaveCount(0);
      return { remotePreserved: true, keepSafe: true };
    });
    await check(kind + '-cancel-unrelated-and-reopen', kind, async h => {
      let dialog = await openEdit(h, kind); const before = await h.snap();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).toHaveCount(0);
      assert.equal((await h.snap()).revision, before.revision, 'cancel must not write');
      dialog = await openEdit(h, kind);
      const other = kind === 'sleeps' ? sleep({ start: '2026-10-17T13:00:00.000Z', end: '2026-10-17T14:00:00.000Z' }) : report({ name: 'Other synthetic report' });
      await h.mutate(kind, other.id, other); await h.refresh();
      await dialog.getByRole('button', { name: saveLabel(kind), exact: true }).click(); await expect(dialog).toHaveCount(0);
      const s = await h.snap(); assert.equal(s.state[kind].length, 2); assert.deepEqual(s.state[kind].find((x: any) => x.id === other.id), other);
      assert.equal(kind === 'sleeps' ? s.state[kind].find((x: any) => x.id === h.item.id).quality : s.state[kind].find((x: any) => x.id === h.item.id).markers[0].value, kind === 'sleeps' ? 5 : '11');
      await h.p.getByRole('button', { name: deleteOpen(kind), exact: true }).first().click();
      dialog = h.p.getByRole('dialog'); const revision = s.revision;
      await dialog.getByRole('button', { name: 'Keep', exact: true }).click(); await expect(dialog).toHaveCount(0); assert.equal((await h.snap()).revision, revision);
      return { cancelWrites: 0, disjointPreserved: true, edited: true, keepWrites: 0 };
    });
    await check(kind + '-own-uncertain-save-retry', kind, async h => {
      const dialog = await openEdit(h, kind); let accepted = false, blocked = true; const ids: string[] = [];
      await h.p.route('**/api/sync', async (route: any) => { if (route.request().method() !== 'POST') return route.continue(); ids.push(route.request().postDataJSON().mutationId); if (blocked) { if (!accepted) { const response = await route.fetch(); assert.equal(response.status(), 200); accepted = true; } return route.abort('failed'); } return route.continue(); });
      await dialog.getByRole('button', { name: saveLabel(kind), exact: true }).click();
      await expect(dialog.getByRole('alert')).toContainText('not confirmed'); await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('pending 1');
      blocked = false; await h.p.getByRole('button', { name: 'Retry queued sync', exact: true }).click(); await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('synced');
      assert.equal(new Set(ids).size, 1, 'uncertain transport retry must reuse the original mutation');
      if (kind === 'sleeps') await dialog.getByLabel('Sleep quality (1–5)', { exact: true }).selectOption('4'); else await dialog.getByLabel('Original value (including > or <)', { exact: true }).fill('12');
      await dialog.getByRole('button', { name: saveLabel(kind), exact: true }).click(); await expect(dialog).toHaveCount(0);
      const rows = (await h.snap()).state[kind]; assert.equal(rows.length, 1); assert.equal(rows[0].id, h.item.id);
      assert.equal(kind === 'sleeps' ? rows[0].quality : rows[0].markers[0].value, kind === 'sleeps' ? 4 : '12');
      return { originalMutationReplayed: true, oneRecord: true, ownCorrectionSaved: true };
    });
    await check(kind + '-own-uncertain-delete-retry', kind, async h => {
      await h.p.getByRole('button', { name: deleteOpen(kind), exact: true }).click(); const dialog = h.p.getByRole('dialog');
      let accepted = false, blocked = true; const ids: string[] = [];
      await h.p.route('**/api/sync', async (route: any) => { if (route.request().method() !== 'POST') return route.continue(); ids.push(route.request().postDataJSON().mutationId); if (blocked) { if (!accepted) { const response = await route.fetch(); assert.equal(response.status(), 200); accepted = true; } return route.abort('failed'); } return route.continue(); });
      await dialog.getByRole('button', { name: deleteLabel(kind), exact: true }).click();
      await expect(dialog.getByRole('alert')).toBeVisible(); await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('pending 1');
      blocked = false; await h.p.getByRole('button', { name: 'Retry queued sync', exact: true }).click(); await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('synced');
      await dialog.getByRole('button', { name: deleteLabel(kind), exact: true }).click(); await expect(dialog).toHaveCount(0);
      assert.deepEqual((await h.snap()).state[kind], []); assert.equal(new Set(ids).size, 1, 'accepted deletion retry replays one original mutation');
      return { originalMutationReplayed: true, deleteConfirmed: true };
    });
  }
  await check('reports-uncertain-attachment-cancel', 'reports', async h => {
    const dialog = await openEdit(h, 'reports');
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'replacement-synthetic.pdf', mimeType: 'application/pdf', buffer: syntheticPdf });
    let blocked = true, assetId = '';
    h.p.on('response', async (response: any) => { if (response.url().endsWith('/api/assets') && response.request().method() === 'POST' && response.status() === 201) assetId = (await response.json()).id; });
    await h.p.route('**/api/sync', (route: any) => route.request().method() === 'POST' && blocked ? route.abort('failed') : route.continue());
    await dialog.getByRole('button', { name: saveLabel('reports'), exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('not confirmed');
    assert.ok(assetId, 'the replacement private upload was created');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).toHaveCount(0);
    const retained = await h.ctx.request.get(base + '/api/assets/' + assetId); assert.equal(retained.status(), 200, 'cancel must retain an attachment referenced by a queued write');
    blocked = false; await h.p.getByRole('button', { name: 'Retry queued sync', exact: true }).click(); await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('synced');
    const saved = (await h.snap()).state.reports[0]; assert.equal(saved.assetId, assetId); assert.equal(saved.markers[0].value, '11');
    const attachment = await h.ctx.request.get(base + '/api/assets/' + assetId); assert.equal(attachment.status(), 200);
    assert.deepEqual(await attachment.body(), syntheticPdf); return { queuedAttachmentRetained: true, syncedAssetId: assetId, markersPreserved: true };
  });
} finally {
  if (browser) await browser.close(); await vite.close();
  await new Promise<void>((done, reject) => apiServer.close(error => error ? reject(error) : done())); fixture.close();
  await writeFile(join(out, 'results.json'), JSON.stringify({ scope: 'Real Sleep/Reports component DOM + SyncEngine + local synthetic HTTP/SQLite; full App/build not tested', tests, pageErrors: errors }, null, 2));
}
assert.ok(tests.length > 0, 'At least one selected test must run');
assert.ok(tests.every(test => test.passed), 'Some browser lifecycle checks failed');
assert.deepEqual(errors, [], 'No page errors');
