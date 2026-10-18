import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
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
  useEffect(()=>{void boot(); const refresh=()=>{void engineRef.current?.refresh();}; window.addEventListener('online',refresh); return()=>{window.removeEventListener('online',refresh); void engineRef.current?.stop();};},[]);
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
      <button onClick={()=>engine.enable(true)}>Enable synthetic offline storage</button>
    </nav>
    <p role="status" aria-label="Synthetic sync status">{status.busy?'busy':status.pending?'pending '+status.pending:'synced'}</p>
    <p role="status" aria-label="Synthetic account">{engine.user.id}</p>
    <p role="status" aria-label="Synthetic offline consent">{status.enabled?'enabled':'disabled'}</p>
    <p aria-label="Synthetic notification">{message}</p>
    <Feature key={kind+engine.user.id} state={state} lang="en" save={save} notify={(zh,en)=>setMessage(en||zh)} demo={false} accountId={engine.user.id}/>
  </main>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
`;
let vite: any;
try {
vite = await createServer({ root: repo, configFile: false, cacheDir: join(out, 'vite-cache'),
  // Follow the process-only resolver when a checkout has incomplete shared dependencies.
  // No package/cache writes are made to the dependency source worktree.
  resolve: { alias: Object.fromEntries(['react', 'react-dom', 'scheduler', 'lucide-react'].map(name => [name, dirname(require.resolve(name + '/package.json'))])), dedupe: ['react', 'scheduler'] },
  esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', 'lucide-react'] },
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
async function observeAccount(user: any) {
  // A new login retires the caller's previous cookie. Use an independent synthetic
  // session, rather than copying a cookie which the account-switch step invalidates.
  const ctx = await browser.newContext();
  try {
    const result = await http(ctx, 'POST', '/auth/login', undefined, { email: user.email, password: 'Synthetic-lifecycle-password-2026' });
    assert.equal(result.user.id, user.id);
    return ctx;
  } catch (error) { await ctx.close(); throw error; }
}
async function upsert(ctx: any, userId: string, kind: string, item: any) {
  const s = await http(ctx, 'GET', '/sync', userId);
  return http(ctx, 'POST', '/sync', userId, { mutationId: randomUUID(), changes: [{ collection: kind, id: item.id, baseVersion: s.entityVersions[kind + ':' + item.id] ?? 0, kind: 'upsert', value: item }] });
}
async function secondAccount(h: any, kind: string) {
  const user = await register(h.ctx);
  const asset = kind === 'reports' ? await http(h.ctx, 'POST', '/assets', user.id, { name: 'account-b.pdf', mime: 'application/pdf', base64: syntheticPdf.toString('base64') }) : null;
  // Reusing a record ID is legal between owners and exposes accidental draft carry-over.
  const item = kind === 'sleeps' ? { ...h.item, quality: 2, energy: 2 } : { ...h.item, assetId: asset.id, markers: [{ ...h.item.markers[0], value: '30' }] };
  await upsert(h.ctx, user.id, kind, item);
  return { user, item, before: await http(h.ctx, 'GET', '/sync', user.id) };
}
async function reloadAccount(h: any, id: string) {
  // Simulate the external account transition while a native modal blocks pointer input.
  // This dispatch is a fixture control; product editors/confirmations use real clicks.
  await h.p.getByRole('button', { name: 'Reload synthetic account', exact: true }).dispatchEvent('click');
  await expect(h.p.getByRole('status', { name: 'Synthetic account', exact: true })).toHaveText(id);
  await expect(h.p.getByRole('status', { name: 'Synthetic sync status', exact: true })).not.toHaveText('busy');
  if (await h.p.getByLabel('Wake-up date', { exact: true }).count()) await h.p.getByLabel('Wake-up date', { exact: true }).fill(day);
}
async function cachedAccount(p: any, id: string) {
  return p.evaluate(async (accountId: string) => { const path = '/src/sync/storage.ts'; return (await import(path)).readCached(accountId); }, id);
}
async function privatePdf(ctx: any, id: string, status = 200) {
  const response = await ctx.request.get(base + '/api/assets/' + id);
  assert.equal(response.status(), status, 'private attachment owner boundary');
  if (status === 200) assert.deepEqual(await response.body(), syntheticPdf, 'synthetic PDF bytes remain intact');
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
  const refreshNow = async () => { const response = p.waitForResponse((r: any) => r.url().endsWith('/api/sync') && r.request().method() === 'GET'); await p.evaluate(() => window.dispatchEvent(new Event('online'))); await response; await expect(p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('synced'); };
  return { ctx, p, user, item, snap, mutate, refresh: refreshNow };
}
async function openEdit(h: any, kind: string) {
  await h.p.getByRole('button', { name: kind === 'sleeps' ? 'Edit this sleep' : 'Edit Synthetic report', exact: true }).click();
  const dialog = h.p.getByRole('dialog');
  if (kind === 'sleeps') await dialog.getByLabel('Sleep quality (1–5)').selectOption('5');
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
      await h.p.screenshot({ path: join(out, kind + '-stale-edit-' + change + '-guard.png'), animations: 'disabled' });
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
      await h.p.screenshot({ path: join(out, kind + '-stale-delete-guard.png'), animations: 'disabled' });
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
      blocked = false; await h.p.evaluate(() => window.dispatchEvent(new Event('online'))); await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('synced');
      assert.equal(new Set(ids).size, 1, 'uncertain transport retry must reuse the original mutation');
      if (kind === 'sleeps') await dialog.getByLabel('Sleep quality (1–5)').selectOption('4'); else await dialog.getByLabel('Original value (including > or <)', { exact: true }).fill('12');
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
      blocked = false; await h.p.evaluate(() => window.dispatchEvent(new Event('online'))); await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('synced');
      await dialog.getByRole('button', { name: deleteLabel(kind), exact: true }).click(); await expect(dialog).toHaveCount(0);
      assert.deepEqual((await h.snap()).state[kind], []); assert.equal(new Set(ids).size, 1, 'accepted deletion retry replays one original mutation');
      return { originalMutationReplayed: true, deleteConfirmed: true };
    });
    // CF-17 recheck: gaps not exercised by the original 13 cases.
    await check(kind + '-stale-delete-confirmation-remote-delete', kind, async h => {
      await h.p.getByRole('button', { name: deleteOpen(kind), exact: true }).click(); const dialog = h.p.getByRole('dialog');
      await h.mutate(kind, h.item.id, undefined); await h.refresh();
      const before = await h.snap(); const posts: string[] = [];
      h.p.on('request', (request: any) => { if (request.url().endsWith('/api/sync') && request.method() === 'POST') posts.push(request.url()); });
      await dialog.getByRole('button', { name: deleteLabel(kind), exact: true }).click();
      await h.p.waitForFunction(() => { const button = document.querySelector<HTMLButtonElement>('dialog button.btn-primary'); return !button || !button.disabled; });
      const after = await h.snap();
      assert.deepEqual(after.state[kind], [], 'stale confirmation must not recreate the remotely deleted record');
      assert.equal(after.revision, before.revision, 'stale confirmation must not write');
      assert.equal(posts.length, 0, 'stale confirmation must not even submit an ineffective mutation');
      const stillOpen = await dialog.count() > 0;
      if (stillOpen) { await expect(dialog.getByRole('alert')).toBeVisible(); await dialog.getByRole('button', { name: 'Keep', exact: true }).click(); await expect(dialog).toHaveCount(0); }
      return { remoteDeletionPreserved: true, writes: posts.length, dialogStayedWithAlert: stillOpen };
    });
    await check(kind + '-own-uncertain-save-then-remote-change', kind, async h => {
      const dialog = await openEdit(h, kind); let accepted = false, blocked = true;
      await h.p.route('**/api/sync', async (route: any) => { if (route.request().method() !== 'POST') return route.continue(); if (blocked) { if (!accepted) { const response = await route.fetch(); assert.equal(response.status(), 200); accepted = true; } return route.abort('failed'); } return route.continue(); });
      await dialog.getByRole('button', { name: saveLabel(kind), exact: true }).click();
      await expect(dialog.getByRole('alert')).toContainText('not confirmed');
      blocked = false; await h.p.evaluate(() => window.dispatchEvent(new Event('online'))); await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('synced');
      const own = (await h.snap()).state[kind][0];
      assert.equal(kind === 'sleeps' ? own.quality : own.markers[0].value, kind === 'sleeps' ? 5 : '11', 'own uncertain write was accepted');
      const remote = kind === 'sleeps' ? { ...own, quality: 2 } : { ...own, markers: [{ ...own.markers[0], value: '30' }] };
      await h.mutate(kind, h.item.id, remote); await h.refresh();
      if (kind === 'sleeps') await dialog.getByLabel('Sleep quality (1–5)').selectOption('4'); else await dialog.getByLabel('Original value (including > or <)', { exact: true }).fill('12');
      await dialog.getByRole('button', { name: saveLabel(kind), exact: true }).click();
      await h.p.waitForFunction(() => { const button = document.querySelector<HTMLButtonElement>('dialog button.btn-primary'); return !button || !button.disabled; });
      assert.deepEqual((await h.snap()).state[kind], [remote], 'retry after own accepted write must not overwrite a later remote change');
      await expect(dialog.getByRole('alert')).toContainText('changed');
      await h.p.screenshot({ path: join(out, kind + '-own-uncertain-then-remote-guard.png'), animations: 'disabled' });
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).toHaveCount(0);
      if (kind === 'reports') assert.equal((await h.ctx.request.get(base + '/api/assets/' + h.item.assetId)).status(), 200, 'referenced attachment kept');
      return { ownWriteAccepted: true, laterRemotePreserved: true, cancelSafe: true };
    });
    for (const mode of ['editor', 'delete']) await check(kind + '-account-remount-' + mode, kind, async h => {
      const observerA = await observeAccount(h.user);
      try {
        const beforeA = await h.snap();
        if (mode === 'editor') await openEdit(h, kind);
        else await h.p.getByRole('button', { name: deleteOpen(kind), exact: true }).click();
        await expect(h.p.getByRole('dialog')).toHaveCount(1);
        const b = await secondAccount(h, kind), writes: any[] = [];
        h.p.on('request', (request: any) => { if (request.url().endsWith('/api/sync') && request.method() === 'POST') writes.push({ account: request.headers()['x-forma-account'], mutationId: request.postDataJSON().mutationId }); });
        await reloadAccount(h, b.user.id);
        await expect(h.p.getByRole('dialog')).toHaveCount(0);
        assert.deepEqual(await http(h.ctx, 'GET', '/sync', b.user.id), b.before, 'account remount alone cannot submit the old editor or confirmation');
        assert.equal(writes.length, 0);
        if (mode === 'editor') {
          await h.p.getByRole('button', { name: kind === 'sleeps' ? 'Edit this sleep' : 'Edit Synthetic report', exact: true }).click();
          const dialog = h.p.getByRole('dialog');
          if (kind === 'sleeps') { await expect(dialog.getByLabel('Sleep quality (1–5)')).toHaveValue('2'); await dialog.getByLabel('Sleep quality (1–5)').selectOption('4'); }
          else { await expect(dialog.getByLabel('Original value (including > or <)', { exact: true })).toHaveValue('30'); await dialog.getByLabel('Original value (including > or <)', { exact: true }).fill('31'); }
          await dialog.getByRole('button', { name: saveLabel(kind), exact: true }).click(); await expect(dialog).toHaveCount(0);
          const actualB = (await http(h.ctx, 'GET', '/sync', b.user.id)).state[kind];
          assert.deepEqual(actualB, [{ ...b.item, ...(kind === 'sleeps' ? { quality: 4 } : { markers: [{ ...b.item.markers[0], value: '31' }] }) }]);
        } else {
          await h.p.getByRole('button', { name: deleteOpen(kind), exact: true }).click();
          await h.p.getByRole('dialog').getByRole('button', { name: deleteLabel(kind), exact: true }).click();
          await expect(h.p.getByRole('dialog')).toHaveCount(0);
          assert.deepEqual((await http(h.ctx, 'GET', '/sync', b.user.id)).state[kind], []);
        }
        assert.equal(writes.length, 1, 'only the explicitly reopened B editor/confirmation may write');
        assert.equal(writes[0].account, b.user.id, 'the new component writes as B');
        assert.deepEqual(await http(observerA, 'GET', '/sync', h.user.id), beforeA, 'A remains byte-for-byte unchanged');
        if (kind === 'reports') { await privatePdf(observerA, h.item.assetId); await privatePdf(h.ctx, h.item.assetId, 404); }
        return { sameRecordId: true, oldDialogUnmounted: true, remountWrites: 0, explicitNewOwnerWrites: writes, originalAccountUnchanged: true, ...(kind === 'reports' ? { originalAttachmentIntact: true, foreignAttachmentDenied: true } : {}) };
      } finally { await observerA.close(); }
    });
  }
  await check('reports-account-remount-delayed-upload', 'reports', async h => {
    const observerA = await observeAccount(h.user);
    let release!: () => void;
    const held = new Promise<void>(done => { release = done; });
    let uploaded: any;
    const requests: any[] = [];
    try {
      const beforeA = await h.snap(), dialog = await openEdit(h, 'reports');
      await dialog.locator('input[type="file"]').setInputFiles({ name: 'delayed-account-a.pdf', mimeType: 'application/pdf', buffer: syntheticPdf });
      h.p.on('request', (request: any) => { if (request.url().includes('/api/assets') || request.url().endsWith('/api/sync') && request.method() === 'POST') requests.push({ method: request.method(), path: new URL(request.url()).pathname, account: request.headers()['x-forma-account'] }); });
      await h.p.route('**/api/assets', async (route: any) => {
        if (route.request().method() !== 'POST') return route.continue();
        const response = await route.fetch(); assert.equal(response.status(), 201); uploaded = await response.json();
        await held; await route.fulfill({ response });
      });
      await dialog.getByRole('button', { name: saveLabel('reports'), exact: true }).click();
      await expect.poll(() => uploaded?.id).toBeTruthy();
      await privatePdf(observerA, uploaded.id);
      const b = await secondAccount(h, 'reports'); await reloadAccount(h, b.user.id);
      await expect(h.p.getByRole('dialog')).toHaveCount(0);
      const cleanup = h.p.waitForResponse((r: any) => r.url().endsWith('/api/assets/' + uploaded.id) && r.request().method() === 'DELETE');
      release(); assert.equal((await cleanup).status(), 401, 'late A cleanup cannot act with B session cookies');
      assert.deepEqual(requests.filter(r => r.method === 'POST').map(r => r.account), [h.user.id], 'the held upload is explicitly owned by A and never submits a stale report');
      assert.deepEqual(requests.filter(r => r.method === 'DELETE').map(r => r.account), [h.user.id], 'late cleanup retains the original owner header');
      assert.deepEqual(await http(observerA, 'GET', '/sync', h.user.id), beforeA);
      assert.deepEqual(await http(h.ctx, 'GET', '/sync', b.user.id), b.before);
      await privatePdf(observerA, h.item.assetId); await privatePdf(observerA, uploaded.id); await privatePdf(h.ctx, uploaded.id, 404); await privatePdf(h.ctx, b.item.assetId);
      return { lateUploadOwner: h.user.id, cleanupStatus: 401, oldDialogUnmounted: true, bothAccountSnapshotsUnchanged: true, originalAndLateAttachmentIntact: true, foreignAttachmentDenied: true, requests };
    } finally { release(); await observerA.close(); }
  });
  await check('reports-account-remount-offline-queue', 'reports', async h => {
    const observerA = await observeAccount(h.user);
    let observerB: any, blocked = true, assetId = '';
    const writes: any[] = [];
    try {
      const beforeA = await h.snap();
      await h.p.getByRole('button', { name: 'Enable synthetic offline storage', exact: true }).click();
      await expect(h.p.getByRole('status', { name: 'Synthetic offline consent', exact: true })).toHaveText('enabled');
      const dialog = await openEdit(h, 'reports');
      await dialog.locator('input[type="file"]').setInputFiles({ name: 'queued-account-a.pdf', mimeType: 'application/pdf', buffer: syntheticPdf });
      const uploadResponse = h.p.waitForResponse((response: any) => response.url().endsWith('/api/assets') && response.request().method() === 'POST' && response.status() === 201);
      await h.p.route('**/api/sync', (route: any) => {
        if (route.request().method() !== 'POST') return route.continue();
        writes.push({ account: route.request().headers()['x-forma-account'], mutationId: route.request().postDataJSON().mutationId });
        return blocked ? route.abort('failed') : route.continue();
      });
      await dialog.getByRole('button', { name: saveLabel('reports'), exact: true }).click(); await expect(dialog).toHaveCount(0);
      assetId = (await (await uploadResponse).json()).id;
      await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('pending 1');
      const queuedA = await cachedAccount(h.p, h.user.id);
      assert.ok(assetId); assert.equal(queuedA.user.id, h.user.id); assert.equal(queuedA.queue.length, 1);
      assert.equal(queuedA.queue[0].changes[0].value.assetId, assetId);
      assert.deepEqual(await http(observerA, 'GET', '/sync', h.user.id), beforeA, 'aborted queue has not reached the server');
      const b = await secondAccount(h, 'reports'); observerB = await observeAccount(b.user);
      await reloadAccount(h, b.user.id);
      await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('synced');
      await expect(h.p.getByRole('status', { name: 'Synthetic offline consent', exact: true })).toHaveText('disabled');
      const countBeforeBRetry = writes.length;
      const refreshedB = h.p.waitForResponse((r: any) => r.url().endsWith('/api/sync') && r.request().method() === 'GET');
      await h.p.getByRole('button', { name: 'Retry queued sync', exact: true }).click(); await refreshedB;
      assert.equal(writes.length, countBeforeBRetry, 'B retry cannot drain A outbox');
      assert.deepEqual((await cachedAccount(h.p, h.user.id)).queue, queuedA.queue, 'A durable queue remains unchanged during B use');
      assert.equal(await cachedAccount(h.p, b.user.id), undefined, 'A consent does not create a B cache');
      assert.deepEqual(await http(h.ctx, 'GET', '/sync', b.user.id), b.before);
      await privatePdf(observerA, h.item.assetId); await privatePdf(observerA, assetId); await privatePdf(h.ctx, assetId, 404); await privatePdf(h.ctx, b.item.assetId);
      // Restore only this synthetic context's A cookie, then remount and replay its exact stored mutation.
      await h.ctx.clearCookies(); await h.ctx.addCookies((await observerA.storageState()).cookies);
      await reloadAccount(h, h.user.id);
      await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('pending 1');
      blocked = false; await h.p.getByRole('button', { name: 'Retry queued sync', exact: true }).click();
      await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('synced');
      assert.ok(writes.length > countBeforeBRetry); assert.ok(writes.every(write => write.account === h.user.id && write.mutationId === queuedA.queue[0].mutationId), 'original owner and exact mutation identity survive remount');
      const actualA = await h.snap(); assert.deepEqual(actualA.state.reports, [{ ...h.item, assetId, markers: [{ ...h.item.markers[0], value: '11' }] }]);
      assert.equal((await cachedAccount(h.p, h.user.id)).queue.length, 0); await privatePdf(h.ctx, assetId);
      assert.deepEqual(await http(observerB, 'GET', '/sync', b.user.id), b.before); await privatePdf(observerB, b.item.assetId);
      return { originalMutation: queuedA.queue[0].mutationId, writes, bRetryWrites: 0, durableQueueRestored: true, attachmentBytesIntact: true, foreignAttachmentDenied: true, bSnapshotUnchanged: true };
    } finally { await observerA.close(); if (observerB) await observerB.close(); }
  });
  await check('reports-uncertain-attachment-conflict-cancel', 'reports', async h => {
    const dialog = await openEdit(h, 'reports');
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'conflict-synthetic.pdf', mimeType: 'application/pdf', buffer: syntheticPdf });
    let blocked = true, assetId = '';
    h.p.on('response', async (response: any) => { if (response.url().endsWith('/api/assets') && response.request().method() === 'POST' && response.status() === 201) assetId = (await response.json()).id; });
    await h.p.route('**/api/sync', (route: any) => route.request().method() === 'POST' && blocked ? route.abort('failed') : route.continue());
    await dialog.getByRole('button', { name: saveLabel('reports'), exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('not confirmed');
    assert.ok(assetId, 'the replacement private upload was created');
    await expect(h.p.getByRole('status', { name: 'Synthetic sync status' })).toHaveText('pending 1');
    // Another device changes the same report while this write is still queued.
    const current = (await h.snap()).state.reports[0];
    const remote = { ...current, markers: [{ ...current.markers[0], value: '30' }] };
    await h.mutate('reports', h.item.id, remote);
    blocked = false;
    const conflict = h.p.waitForResponse((r: any) => r.url().endsWith('/api/sync') && r.request().method() === 'POST');
    await h.p.evaluate(() => window.dispatchEvent(new Event('online')));
    const conflictStatus = (await conflict).status();
    assert.equal(conflictStatus, 409, 'queued write must hit a server conflict, not overwrite');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).toHaveCount(0);
    await h.p.screenshot({ path: join(out, 'reports-uncertain-attachment-conflict-cancel.png'), animations: 'disabled' });
    assert.deepEqual((await h.snap()).state.reports, [remote], 'server keeps the remote correction while the conflict awaits review');
    const queued = await h.ctx.request.get(base + '/api/assets/' + assetId);
    assert.equal(queued.status(), 200, 'cancel must retain an attachment referenced by the conflicted queued write');
    assert.deepEqual(await queued.body(), syntheticPdf);
    const original = await h.ctx.request.get(base + '/api/assets/' + h.item.assetId);
    assert.equal(original.status(), 200, 'original attachment still referenced by the server record');
    return { conflictStatus, remotePreserved: true, queuedAttachmentRetained: true, originalAttachmentRetained: true };
  });
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
