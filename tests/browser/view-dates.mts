/** Isolated real Dashboard/Trends rendering, synthetic state only; no backend or account. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = process.cwd();
const out = resolve(root, '.forma-local/web-date-01');
await mkdir(out, { recursive: true });
const fixture = `import React from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from '../../src/features/Dashboard';
import {Trends} from '../../src/features/Trends';
import {emptyState} from '../../src/types';
const q=new URLSearchParams(location.search);
const state=emptyState();
const dates=['2026-10-10','2026-10-11','2026-10-16','2026-10-17','2026-10-18'];
state.profile=q.get('zone')==='missing'?null:{timezone:q.get('zone')};
state.meals=dates.map((date,i)=>({id:'meal-'+i,date,createdAt:date+'T12:00:00Z',name:'Fixture '+date,type:'lunch',grams:100,referenceGrams:100,kcal:date==='2026-10-17'?0:100,protein:0,carbs:0,fat:0,source:'label'}));
state.completedActions={'2026-10-16':['nutrition']};
window.__before=structuredClone(state);
const props={state,lang:q.get('lang')||'en',save:async next=>{window.__saved=next},notify:message=>{throw new Error(message)},demo:false,accountId:'synthetic',navigate:()=>{},onCreate:()=>{}};
createRoot(document.getElementById('root')).render(q.get('page')==='trends'?<Trends {...props}/>:<Dashboard {...props}/>);`;
await writeFile(resolve(out, 'fixture.tsx'), fixture);
const server = await createServer({
  root, configFile: false, appType: 'custom', server: { host: '127.0.0.1', port: 0 },
  esbuild: { jsx: 'automatic' },
  plugins: [{ name: 'isolate-companion', enforce: 'pre', load(id) {
    if (id.replaceAll('\\', '/').endsWith('/src/features/Companion.tsx')) return 'export function CompanionCard(){return null;}';
  } }],
});
server.middlewares.use((req, res, next) => {
  if (req.url?.split('?')[0] !== '/__view-dates') return next();
  server.transformIndexHtml('/__view-dates', '<html><body><div id="root"></div><script type="module" src="/.forma-local/web-date-01/fixture.tsx"></script></body></html>')
    .then(html => { res.setHeader('Content-Type', 'text/html'); res.end(html); })
    .catch(error => { res.statusCode = 500; res.end(String(error)); });
});
await server.listen();
const address = server.httpServer!.address();
assert.ok(address && typeof address !== 'string');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, ...(existsSync(chrome) ? { executablePath: chrome } : {}) });
const results: object[] = [];
try {
  for (const [browserZone, profileZone, day] of [
    ['America/Los_Angeles', 'Asia/Shanghai', '2026-10-17'],
    ['Asia/Shanghai', 'America/Los_Angeles', '2026-10-16'],
    ['America/Los_Angeles', 'America/Los_Angeles', '2026-10-16'],
    ['America/Los_Angeles', 'Mars/Olympus', '2026-10-16'],
    ['America/Los_Angeles', 'missing', '2026-10-16'],
    ['Pacific/Kiritimati', 'Asia/Shanghai', '2026-10-17'],
  ]) for (const lang of ['en', 'zh']) {
    const context = await browser.newContext({ timezoneId: browserZone });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-17T06:30:00Z') });
    const url = `http://127.0.0.1:${address.port}/__view-dates?zone=${encodeURIComponent(profileZone)}&lang=${lang}`;
    await page.goto(url); await page.waitForLoadState('networkidle');
    await page.locator('.bar-column').last().waitFor({timeout:10000}).catch(async error => { throw new Error(JSON.stringify({errors,body:await page.locator('body').innerText()})+' '+error.message); });
    const bars = await page.locator('.bar-column').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')));
    assert.equal(bars.length, 7); assert.ok(bars.at(-1)?.startsWith(day + ':'));
    assert.equal(await page.locator('.today-bar').count(), 1);
    const expectedFirst = day === '2026-10-17' ? '2026-10-11' : '2026-10-10';
    assert.ok(bars[0]?.startsWith(expectedFirst + ':'));
    const metrics = await page.locator('.metric-value').allTextContents();
    assert.equal(metrics[0].trim(), day === '2026-10-17' ? '0kcal' : '100kcal');
    assert.ok(metrics[1].includes('—')); assert.ok(metrics[2].includes('—'));
    await page.getByRole('button', { name: lang === 'en' ? 'Full body strength completion' : '全身力量训练 完成状态' }).click();
    const captured = await page.evaluate(() => ({ before: (window as any).__before, saved: (window as any).__saved }));
    assert.deepEqual(captured.saved.meals, captured.before.meals);
    assert.deepEqual(captured.saved.sleeps, captured.before.sleeps);
    assert.ok(captured.saved.completedActions[day].includes('training'));
    assert.ok(captured.saved.completedActions['2026-10-16'].includes('nutrition'));
    await page.goto(url + '&page=trends'); await page.waitForLoadState('networkidle');
    const selected = page.getByRole('heading', { level: 3 }).first();
    await selected.waitFor();
    const selectedText = await selected.textContent();
    assert.ok(selectedText?.includes(day.endsWith('17') ? '17' : '16'), selectedText ?? 'missing selected day');
    const seven = page.locator('svg[role="group"] g[role="button"]');
    assert.equal(await seven.count(), 7);
    const selectedNutrition = await seven.last().getAttribute('aria-label');
    assert.ok(selectedNutrition?.includes(day.endsWith('17') ? '0 kcal' : '100 kcal'));
    await page.getByRole('button', { name: lang === 'en' ? 'Last 14 days' : '最近 14 天', exact: true }).click();
    assert.equal(await seven.count(), 14);
    await page.getByRole('button', { name: lang === 'en' ? 'Last 7 days' : '最近 7 天', exact: true }).click();
    assert.equal(await seven.count(), 7);
    assert.deepEqual(errors, []);
    results.push({ browserZone, profileZone, lang, day, status: 'pass' });
    await context.close();
  }
  await writeFile(resolve(out, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ cases: results.length, passed: results.length, scope: 'isolated real Dashboard/Trends; CompanionCard stubbed; synthetic save capture; no App/backend' }));
} finally {
  await browser.close(); await server.close();
}
