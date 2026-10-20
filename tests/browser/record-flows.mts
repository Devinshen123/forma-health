import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createApp } from '../../server/app';
import { createServer } from 'node:http';
const repo = join(import.meta.dirname, '../..'), require = createRequire(join(repo, 'package.json'));
const { chromium, expect } = require('@playwright/test');
const outputDirectory = process.env.FORMA_TEST_OUTPUT;
if (!outputDirectory)
    throw Error('Set FORMA_TEST_OUTPUT to a dedicated synthetic test directory');
const out: string = outputDirectory;
await mkdir(out, { recursive: true });
const trustedOrigin = 'http://127.0.0.1:5173', tests: any[] = [], errors: string[] = [];
const fixture = createApp({ dataDir: join(out, 'data'), distDir: join(repo, 'dist'), secureCookies: false, ai: {} });
let base = '';
// The isolated browser's ephemeral origin maps to the normal local frontend.
// Production Origin validation remains unchanged and has its own HTTP tests.
const server = await new Promise<any>((resolve, reject) => { const s = createServer((req, res) => {
    if (req.headers.origin === base) req.headers.origin = trustedOrigin;
    fixture.app(req, res);
}); s.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject); });
base = `http://127.0.0.1:${server.address().port}`;
let browser: any;
async function account() {
    // Record-editor tests route the synthetic API; the separate offline-shell suite owns SW coverage.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'UTC', serviceWorkers: 'block' });
    await ctx.addInitScript(() => localStorage.setItem('forma-language', 'en'));
    await ctx.route('**/*', (r: any) => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
    const a = await ctx.request.post(base + '/api/auth/register', { headers: { Origin: trustedOrigin }, data: { name: 'Synthetic record QA', email: `qa-${randomUUID()}@example.test`, password: 'Synthetic-only-password-2026' } });
    assert.equal(a.status(), 201);
    const user = (await a.json()).user;
    const profile = { name: 'Synthetic record QA', goal: 'habits', experience: 'regular', trainingDays: 3, timeMinutes: 30, equipment: 'bodyweight', allergies: '', restrictions: '', language: 'en', units: 'metric', timezone: 'UTC', sleepGoal: 8, cloudConsent: false, aiConsent: false };
    const r = await ctx.request.post(base + '/api/sync', { headers: { Origin: trustedOrigin, 'X-Forma-Account': user.id }, data: { mutationId: randomUUID(), changes: [{ collection: 'profile', id: 'profile', kind: 'upsert', baseVersion: 0, value: profile }] } });
    assert.equal(r.status(), 200);
    const p = await ctx.newPage();
    p.on('pageerror', (e: any) => errors.push(String(e)));
    await p.goto(base);
    await expect(p.locator('.sync-summary')).toContainText('Records synced');
    const snap = async () => { const r = await ctx.request.get(base + '/api/sync', { headers: { 'X-Forma-Account': user.id } }); assert.equal(r.status(), 200); return r.json(); };
    const mutate = async (collection: string, id: string, value: any) => { const s = await snap(); const r = await ctx.request.post(base + '/api/sync', { headers: { Origin: trustedOrigin, 'X-Forma-Account': user.id }, data: { mutationId: randomUUID(), changes: [{ collection, id, baseVersion: s.entityVersions[`${collection}:${id}`] ?? 0, kind: value === undefined ? 'delete' : 'upsert', ...(value === undefined ? {} : { value }) }] } }); assert.equal(r.status(), 200); };
    const refresh = async () => { const wait = p.waitForResponse((r: any) => r.url() === base + '/api/sync' && r.request().method() === 'GET'); await p.evaluate(() => window.dispatchEvent(new Event('online'))); await wait; await expect(p.locator('.sync-summary')).toContainText('Records synced'); };
    return { ctx, p, user, snap, mutate, refresh };
}
async function nav(p: any, name: string) { await p.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('button', { name, exact: true }).click(); }
async function cancelMeal(p: any, dialog: any) {
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await p.getByRole('dialog', { name: 'Discard unsaved entries?', exact: true }).getByRole('button', { name: 'Discard entries and close', exact: true }).click();
    await expect(p.getByRole('dialog')).toHaveCount(0);
}
async function addMeal(p: any) { await nav(p, 'Nutrition'); await p.getByRole('button', { name: 'Log a meal', exact: true }).click(); const d = p.getByRole('dialog'); for (const [label, value] of [['Meal name', 'Synthetic meal'], ['Weight eaten (g)', '100'], ['Nutrition reference weight (g)', '100'], ['Energy (kcal)', '100'], ['Protein (g)', '4'], ['Carbs (g)', '15'], ['Fat (g)', '2']])
    await d.getByLabel(label, { exact: true }).fill(value); await d.getByRole('button', { name: 'Confirm and save', exact: true }).click(); await expect(d).toHaveCount(0); }
async function addWorkout(p: any) { await nav(p, 'Training'); await p.getByRole('button', { name: 'Quick summary', exact: true }).click(); await p.getByRole('button', { name: 'Log training', exact: true }).click(); const d = p.getByRole('dialog'); for (const [label, value] of [['Session name', 'Synthetic activity'], ['Duration (min)', '30'], ['Exercise name', 'Synthetic row'], ['Load (kg)', '20']])
    await d.getByLabel(label, { exact: true }).fill(value); await d.getByRole('button', { name: 'Save training', exact: true }).click(); await expect(d).toHaveCount(0); }
async function check(name: string, fn: (h: any) => Promise<any>) { if (process.env.FORMA_QA_MATCH && !new RegExp(process.env.FORMA_QA_MATCH).test(name))
    return; const h = await account(); try {
    const evidence = await fn(h);
    tests.push({ name, passed: true, evidence });
    console.log('PASS ' + name);
}
catch (e: any) {
    const alerts = await h.p.getByRole('alert').allTextContents();
    if (alerts.length) console.log('Synthetic fixture alerts: ' + JSON.stringify(alerts));
    await h.p.screenshot({ path: join(out, name + '.png'), fullPage: false, animations: 'disabled' });
    tests.push({ name, passed: false, error: String(e) });
    console.log('FAIL ' + name + ': ' + e.message);
}
finally {
    await h.ctx.close();
} }
try {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-gpu-compositing'] });
    for (const kind of ['update', 'delete'])
        await check('meal-stale-' + kind, async ({ p, snap, mutate, refresh }: any) => {
            await addMeal(p);
            const original = (await snap()).state.meals[0];
            await p.getByRole('button', { name: 'Edit Synthetic meal', exact: true }).click();
            const d = p.getByRole('dialog');
            await d.getByLabel('Weight eaten (g)', { exact: true }).fill('150');
            await mutate('meals', original.id, kind === 'delete' ? undefined : { ...original, kcal: 200 });
            await refresh();
            const row = p.locator('.record-row').filter({ hasText: 'Synthetic meal' });
            if (kind === 'delete')
                await expect(row).toHaveCount(0);
            else
                await expect(row).toContainText('200');
            await d.getByRole('button', { name: 'Confirm and save', exact: true }).click();
            await p.waitForFunction(() => { const b = document.querySelector<HTMLButtonElement>('button[form="nutrition-form"]'); return !b || !b.disabled; });
            const s = await snap();
            assert.equal(s.state.meals.length, kind === 'delete' ? 0 : 1, 'stale editor must not resurrect deleted records');
            if (kind === 'update')
                assert.equal(s.state.meals[0].kcal, 200, 'stale editor must not overwrite the newly corrected nutrition');
            await expect(d).toBeVisible();
            await expect(d.getByRole('alert')).toContainText('changed');
            await d.getByRole('alert').scrollIntoViewIfNeeded();
            await p.screenshot({ path: join(out, 'meal-stale-guard.png'), fullPage: false, animations: 'disabled' });
            await cancelMeal(p, d);
            return { remotePreserved: true, cancelSafe: true };
        });
    await check('activity-own-uncertain-retry', async ({ p, snap }: any) => {
        await addWorkout(p);
        const original = (await snap()).state.workouts[0];
        await p.getByRole('button', { name: 'Edit Synthetic activity', exact: true }).click();
        const d = p.getByRole('dialog');
        await d.getByLabel('Duration (min)', { exact: true }).fill('45');
        let committed: any, blocked = true;
        await p.route('**/api/sync', async (r: any) => { if (r.request().method() !== 'POST')
            return r.continue(); if (blocked) {
            if (!committed) {
                const response = await r.fetch();
                assert.equal(response.status(), 200);
                committed = await response.json();
            }
            return r.abort('failed');
        } return r.continue(); });
        await d.getByRole('button', { name: 'Save training', exact: true }).click();
        await expect(p.locator('.sync-summary')).toContainText('1 batches pending');
        await expect(d.getByRole('button', { name: 'Save training', exact: true })).toBeEnabled();
        blocked = false;
        await p.evaluate(() => window.dispatchEvent(new Event('online')));
        await expect(p.locator('.sync-summary')).toContainText('Records synced');
        await d.getByLabel('Duration (min)', { exact: true }).fill('60');
        await d.getByRole('button', { name: 'Save training', exact: true }).click();
        await expect(d).toHaveCount(0);
        const s = await snap();
        assert.equal(s.state.workouts.length, 1);
        assert.equal(s.state.workouts[0].id, original.id);
        assert.equal(s.state.workouts[0].duration, 60);
        return { count: 1, idStable: true, duration: 60 };
    });
    await check('activity-unit-switch', async ({ p, snap, mutate, refresh }: any) => {
        await addWorkout(p);
        const original = (await snap()).state.workouts[0];
        await p.getByRole('button', { name: 'Edit Synthetic activity', exact: true }).click();
        const d = p.getByRole('dialog');
        await d.getByLabel('Duration (min)', { exact: true }).fill('45');
        const s = await snap();
        await mutate('profile', 'profile', { ...s.state.profile, units: 'imperial' });
        await refresh();
        await expect(p.locator('.record-row').filter({ hasText: 'Synthetic activity' })).toContainText('lb');
        await expect(d.getByLabel('Load (kg)', { exact: true })).toHaveValue('20');
        await p.screenshot({ path: join(out, 'activity-unit-locked.png'), fullPage: false, animations: 'disabled' });
        await d.getByRole('button', { name: 'Save training', exact: true }).click();
        await expect(d).toHaveCount(0);
        const after = (await snap()).state.workouts[0];
        assert.equal(after.exercises[0].weight, original.exercises[0].weight, 'changing profile display units must not reinterpret an open draft');
        return { loadKg: after.exercises[0].weight, duration: after.duration };
    });
    await check('meal-cancel-disjoint-update-and-delete', async ({ p, snap, mutate, refresh }: any) => {
        await addMeal(p);
        const before = await snap(), meal = before.state.meals[0];
        await p.getByRole('button', { name: 'Edit Synthetic meal', exact: true }).click();
        let d = p.getByRole('dialog');
        await d.getByLabel('Weight eaten (g)', { exact: true }).fill('150');
        await cancelMeal(p, d);
        assert.equal((await snap()).revision, before.revision);
        await p.getByRole('button', { name: 'Edit Synthetic meal', exact: true }).click();
        d = p.getByRole('dialog');
        await d.getByLabel('Weight eaten (g)', { exact: true }).fill('150');
        const other = { ...meal, id: randomUUID(), name: 'Another synthetic meal' };
        await mutate('meals', other.id, other);
        await refresh();
        await expect(p.locator('.record-row').filter({ hasText: other.name })).toHaveCount(1);
        await d.getByRole('button', { name: 'Confirm and save', exact: true }).click();
        await expect(d).toHaveCount(0);
        let s = await snap();
        assert.equal(s.state.meals.length, 2);
        assert.equal(s.state.meals.find((m: any) => m.id === meal.id).grams, 150);
        const revision = s.revision;
        await p.getByRole('button', { name: 'Delete Synthetic meal', exact: true }).click();
        await p.getByRole('dialog').getByRole('button', { name: 'Keep', exact: true }).click();
        await expect(p.getByRole('dialog')).toHaveCount(0);
        assert.equal((await snap()).revision, revision);
        await p.getByRole('button', { name: 'Delete Synthetic meal', exact: true }).click();
        await p.getByRole('dialog').getByRole('button', { name: 'Delete meal', exact: true }).click();
        await expect(p.getByRole('dialog')).toHaveCount(0);
        s = await snap();
        assert.deepEqual(s.state.meals.map((m: any) => m.id), [other.id]);
        return { cancelWrites: 0, otherMealPreserved: true, editSaved: true, confirmedDelete: true };
    });
    await check('meal-stale-delete-confirmation', async ({ p, snap, mutate, refresh }: any) => {
        await addMeal(p);
        const meal = (await snap()).state.meals[0];
        await p.getByRole('button', { name: 'Delete Synthetic meal', exact: true }).click();
        const d = p.getByRole('dialog');
        await mutate('meals', meal.id, { ...meal, kcal: 200 });
        await refresh();
        await expect(p.locator('.record-row').filter({ hasText: meal.name })).toContainText('200');
        await d.getByRole('button', { name: 'Delete meal', exact: true }).click();
        await expect(d.getByRole('alert')).toContainText('changed');
        const s = await snap();
        assert.equal(s.state.meals.length, 1);
        assert.equal(s.state.meals[0].kcal, 200);
        await d.getByRole('button', { name: 'Keep', exact: true }).click();
        return { unreviewedCorrectionPreserved: true };
    });
    await check('activity-cancel-validation-and-delete', async ({ p, snap }: any) => {
        await addWorkout(p);
        const before = await snap();
        await p.getByRole('button', { name: 'Edit Synthetic activity', exact: true }).click();
        const d = p.getByRole('dialog');
        await d.getByLabel('Duration (min)', { exact: true }).fill('0');
        await d.getByRole('button', { name: 'Save training', exact: true }).click();
        assert.equal(await d.getByLabel('Duration (min)', { exact: true }).evaluate((e: HTMLInputElement) => e.validity.valid), false);
        assert.equal((await snap()).revision, before.revision);
        await d.getByLabel('Duration (min)', { exact: true }).fill('45');
        await d.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(d).toHaveCount(0);
        assert.equal((await snap()).state.workouts[0].duration, 30);
        await p.getByRole('button', { name: 'Delete Synthetic activity', exact: true }).click();
        await p.getByRole('dialog').getByRole('button', { name: 'Keep', exact: true }).click();
        assert.equal((await snap()).revision, before.revision);
        await p.getByRole('button', { name: 'Delete Synthetic activity', exact: true }).click();
        await p.getByRole('dialog').getByRole('button', { name: 'Delete session', exact: true }).click();
        await expect(p.getByRole('dialog')).toHaveCount(0);
        assert.equal((await snap()).state.workouts.length, 0);
        return { invalidInputNoWrite: true, editCancelSafe: true, deleteCancelSafe: true };
    });
    await check('mobile-record-editor', async ({ p, snap }: any) => { await addMeal(p); await p.setViewportSize({ width: 390, height: 844 }); await expect(p.locator('.sidebar')).not.toBeInViewport(); await p.getByRole('button', { name: 'Edit Synthetic meal', exact: true }).click(); const d = p.getByRole('dialog'); await d.getByLabel('Weight eaten (g)', { exact: true }).fill('150'); await p.screenshot({ path: join(out, 'mobile-editor.png'), fullPage: false, animations: 'disabled' }); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await cancelMeal(p, d); assert.equal((await snap()).state.meals[0].grams, 100); return { viewport: '390x844', noHorizontalOverflow: true, cancelSafe: true }; });
}
finally {
    if (browser)
        await browser.close();
    await new Promise<void>(r => server.close(() => r()));
    fixture.close();
    await writeFile(join(out, 'results.json'), JSON.stringify({ tests, pageErrors: errors, passed: tests.filter(x => x.passed).length, failed: tests.filter(x => !x.passed).length, gpuDisabled: true }, null, 2));
}
if (tests.some(x => !x.passed) || errors.length)
    process.exitCode = 1;
