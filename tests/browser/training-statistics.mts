import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { Server } from 'node:http';
import { chromium, expect, type BrowserContext, type Frame, type Locator, type Page } from '@playwright/test';
import { createApp } from '../../server/app';
import type { Language, Workout } from '../../src/types';

// Browser plugin not available: use the existing project Playwright and system Edge.
// The lead runs this only after releasing its own trusted-port preview.
const root = resolve(import.meta.dirname, '../..');
assert.ok(process.env.FORMA_TEST_OUTPUT, 'Set FORMA_TEST_OUTPUT to an external synthetic evidence directory');
const out = resolve(process.env.FORMA_TEST_OUTPUT!);
const evidenceRelative = relative(root, out);
assert.ok(evidenceRelative.startsWith('..') || isAbsolute(evidenceRelative), 'Evidence must stay outside the repository');
await mkdir(out, { recursive: true });
const base = 'http://127.0.0.1:5173';
const service = createApp({ dataDir: join(out, 'synthetic-' + randomUUID()), distDir: join(root, 'dist'), secureCookies: false, ai: {} });
const server: Server = service.app.listen(5173, '127.0.0.1');
await new Promise<void>((ready, reject) => { server.once('listening', ready); server.once('error', reject); });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-gpu-compositing'] });
const contexts: BrowserContext[] = [];
const results: { name: string; passed: boolean; evidence?: unknown; error?: string }[] = [];
const pageErrors: string[] = [], consoleErrors: string[] = [], forbiddenOrigins: string[] = [];
const apiErrors: { path: string; status: number }[] = [];
const PASSWORD = 'Synthetic statistics QA password 2026';
const NATIVE_NAME = 'Synthetic native statistics session';
const WORKBENCH_NAME = 'Synthetic workbench statistics session';
const PLAN_NAME = 'Synthetic statistics plan';
const day = new Date().toISOString().slice(0, 10);
const started = Date.parse(day + 'T12:00:00Z');
let activePage: Page | undefined;

async function newContext(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1100 }, timezoneId: 'UTC', reducedMotion: 'reduce' });
  contexts.push(context);
  await context.addInitScript(origin => {
    if (location.origin !== origin) return;
    // A parent language toggle must survive iframe remounts; only initialise once.
    if (!localStorage.getItem('forma-language')) localStorage.setItem('forma-language', 'en');
  }, base);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== base) {
      forbiddenOrigins.push(url.origin);
      return route.abort();
    }
    return route.continue();
  });
  return context;
}

async function newPage(context: BrowserContext) {
  const page = await context.newPage(); activePage = page;
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(message.text()); });
  page.on('response', response => {
    const path = new URL(response.url()).pathname;
    if (response.status() >= 400 && path.includes('/api/')) apiErrors.push({ path, status: response.status() });
  });
  return page;
}

const headers = (account: string) => ({ Origin: base, 'X-Forma-Account': account });
async function register(context: BrowserContext, label: string) {
  const email = `statistics-${label}-${randomUUID()}@example.test`;
  const response = await context.request.post(base + '/api/auth/register', { headers: { Origin: base }, data: { name: `Synthetic statistics ${label}`, email, password: PASSWORD } });
  assert.equal(response.status(), 201);
  const { user } = await response.json();
  const profile = { name: user.name, goal: 'habits', experience: 'regular', trainingDays: 3, timeMinutes: 30, equipment: 'gym', allergies: '', restrictions: '', language: 'en', units: 'metric', timezone: 'UTC', sleepGoal: 8, cloudConsent: false, aiConsent: false };
  const seeded = await context.request.post(base + '/api/sync', { headers: headers(user.id), data: { mutationId: randomUUID(), changes: [{ collection: 'profile', id: 'profile', kind: 'upsert', baseVersion: 0, value: profile }] } });
  assert.equal(seeded.status(), 200);
  return { ...user, email } as { id: string; name: string; email: string };
}
async function nativeState(context: BrowserContext, account: string) {
  const response = await context.request.get(base + '/api/sync', { headers: headers(account) });
  assert.equal(response.status(), 200);
  return response.json();
}
async function workbenchState(context: BrowserContext, account: string) {
  const response = await context.request.get(base + '/training-workbench/api/data', { headers: headers(account) });
  assert.equal(response.status(), 200);
  return response.json();
}
async function mutateNative(context: BrowserContext, account: string, collection: 'workouts' | 'profile', id: string, value?: unknown) {
  const before = await nativeState(context, account);
  const response = await context.request.post(base + '/api/sync', { headers: headers(account), data: { mutationId: randomUUID(), changes: [{ collection, id, kind: value === undefined ? 'delete' : 'upsert', baseVersion: before.entityVersions[`${collection}:${id}`] ?? 0, ...(value === undefined ? {} : { value }) }] } });
  assert.equal(response.status(), 200);
}
async function seedWorkbench(context: BrowserContext, account: string, state: Record<string, unknown>) {
  const before = await workbenchState(context, account);
  const response = await context.request.put(base + '/training-workbench/api/data', { headers: headers(account), data: { state, stamped: true, baseRev: before.rev, ...(before.wid ? { baseWid: before.wid } : {}) } });
  assert.equal(response.status(), 200);
}
function emptyWorkbench() {
  return { lang: 'en', theme: 'light', unit: 'kg', body: 'male', routines: [], workouts: [], customEx: [], bodyweight: [], measurements: [], week: {}, dayPlan: {}, exWeights: {}, weighIn: false, checkIn: false, heatmapMetric: 'time', _ts: Date.now() };
}
async function seedPopulatedAccount(context: BrowserContext, account: string) {
  const native: Workout = {
    id: randomUUID(), date: day, name: NATIVE_NAME, duration: 30, rpe: null, source: 'manual', notes: '', createdAt: new Date(started).toISOString(),
    exercises: [{ id: randomUUID(), name: 'Synthetic native barbell row', sets: 2, reps: 5, weight: 100,
      setLogs: [5, 4].map(reps => ({ id: randomUUID(), kind: 'work' as const, reps, weight: 100, durationSeconds: null, distanceMeters: null, rpe: null, rir: null, completed: true, completedAt: new Date(started).toISOString() })) }],
  };
  const savedNative = await context.request.post(base + '/api/sync', { headers: headers(account), data: { mutationId: randomUUID(), changes: [{ collection: 'workouts', id: native.id, kind: 'upsert', baseVersion: 0, value: native }] } });
  assert.equal(savedNative.status(), 200);
  await seedWorkbench(context, account, {
    ...emptyWorkbench(),
    routines: [{ id: 'synthetic-statistics-routine', name: PLAN_NAME, emoji: 'dumbbell', ex: [{ id: '0022', sets: 1, reps: 6, weight: 30 }] }],
    week: { [new Date(started).getUTCDay()]: 'synthetic-statistics-routine' },
    workouts: [{ id: 'synthetic-statistics-workout', d: day, start: started, end: started + 20 * 60000, name: WORKBENCH_NAME, routineId: 'synthetic-statistics-routine', routineIds: ['synthetic-statistics-routine'], vol: 180,
      entries: [{ id: '0022', target: { mode: 'reps', sets: 1, reps: 6, weight: 30 }, sets: [{ w: 30, r: 6, done: true, at: started + 19 * 60000 }], topW: 30 }], prs: [] }],
    bodyweight: [{ d: new Date(started - 86400000).toISOString().slice(0, 10), t: started - 86400000, w: 71.5 }, { d: day, t: started, w: 72 }],
  });
  const nativeSnapshot = await nativeState(context, account);
  assert.equal(nativeSnapshot.state.workouts.length, 2, 'projection is merged alongside the native workout once');
  assert.equal(nativeSnapshot.state.workouts.filter((item: Workout) => item.importFingerprint?.startsWith('opengym:')).length, 1);
  assert.equal((await workbenchState(context, account)).state.workouts.length, 1, 'native facts are not silently adopted into the workbench');
}

const trainingNavigation = (page: Page, lang: Language = 'en') => page.getByRole('navigation', { name: lang === 'zh' ? '训练功能' : 'Training sections', exact: true });
const mainNavigation = (page: Page, lang: Language = 'en') => page.getByRole('navigation', { name: page.viewportSize()?.width === 390 ? (lang === 'zh' ? '手机导航' : 'Mobile navigation') : (lang === 'zh' ? '主导航' : 'Main navigation'), exact: true });
async function openTraining(page: Page, lang: Language = 'en') {
  activePage = page;
  await mainNavigation(page, lang).getByRole('button', { name: lang === 'zh' ? '训练' : 'Training', exact: true }).click();
  await expect(trainingNavigation(page, lang)).toBeVisible();
}
async function openStatistics(page: Page, lang: Language = 'en') {
  await openTraining(page, lang);
  await trainingNavigation(page, lang).getByRole('button', { name: lang === 'zh' ? '统计' : 'Statistics', exact: true }).click();
  await expect(page.locator('[data-training-summary]')).toBeVisible();
}
async function expectSummary(page: Page, values: [string, string, string, string]) {
  const summary = page.locator('[data-training-summary]');
  for (const [index, key] of ['saved-workouts', 'saved-minutes', 'completed-sets', 'known-volume'].entries()) {
    await expect(summary.locator(`[data-stat="${key}"] strong`)).toHaveText(values[index]);
  }
}
async function embeddedStatistics(page: Page, account: string, lang: Language = 'en', route = '#/stats') {
  const stats = route === '#/stats';
  const title = stats ? (lang === 'zh' ? 'Forma 训练统计' : 'Forma training statistics') : (lang === 'zh' ? 'Forma 训练工作台' : 'Forma training workbench');
  const iframe = page.locator(`iframe[title="${title}"]`);
  await expect(iframe).toBeVisible();
  const element = await iframe.elementHandle(); assert.ok(element);
  const frame = await element.contentFrame(); assert.ok(frame);
  await expect.poll(() => frame.url()).toBe(`${base}/training-workbench/?account=${account}&lang=${lang}${route}`);
  await expect(frame.locator('#tabbar')).toBeVisible();
  await iframe.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  const viewport = page.viewportSize(); assert.ok(viewport);
  await expect.poll(async () => { const box = await iframe.boundingBox(); return !!box && box.y >= -1 && box.y + box.height <= viewport.height + 1; }).toBe(true);
  const url = new URL(frame.url());
  assert.equal(url.origin, base); assert.equal(url.pathname, '/training-workbench/');
  assert.equal(url.searchParams.get('account'), account); assert.equal(url.searchParams.get('lang'), lang); assert.equal(url.hash, route);
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(frame.locator('vite-error-overlay')).toHaveCount(0);
  if (stats) await expect(frame.getByRole('heading', { name: lang === 'zh' ? '统计' : 'Stats', exact: true })).toBeVisible();
  return { frame, iframe };
}
const card = (frame: Frame, heading: string) => frame.locator('.card').filter({ has: frame.getByRole('heading', { name: heading, exact: true }) });
const sourceWorkouts = (frame: Frame) => frame.locator('.tile .l').filter({ hasText: /^Workouts$/ }).locator('..').locator('.v');
async function screenshot(page: Page, name: string, frame?: Frame) {
  const mask: Locator[] = [page.locator('img,video')];
  if (frame) mask.push(frame.locator('img,video'));
  await page.screenshot({ path: join(out, name), mask, maskColor: '#f7f8fa', animations: 'disabled' });
}
async function check(name: string, run: () => Promise<unknown>) {
  try { const evidence = await run(); results.push({ name, passed: true, evidence }); console.log('PASS ' + name); }
  catch (error) {
    if (activePage && !activePage.isClosed()) {
      await writeFile(join(out, 'failed-parent-dom.txt'), await activePage.locator('body').ariaSnapshot());
      const frame = activePage.frames().find(item => item.url().includes('/training-workbench/'));
      if (frame) await writeFile(join(out, 'failed-statistics-dom.txt'), await frame.locator('body').ariaSnapshot());
    }
    results.push({ name, passed: false, error: String(error) }); throw error;
  }
}

try {
  await check('demo-shows-labelled-real-summary-and-never-invents-an-account-iframe', async () => {
    const context = await newContext(), page = await newPage(context);
    await page.goto(base); await expect(page).toHaveTitle(/Forma/i);
    await openStatistics(page);
    await expect(page.locator('.demo-caption')).toHaveText('Demo data');
    await expectSummary(page, ['3', '110', '—', '—']);
    await expect(page.locator('iframe')).toHaveCount(0);
    await screenshot(page, 'statistics-demo.png');
    return { demoLabel: true, demoSavedWorkouts: 3, recordedMinutes: 110, unrecordedDetailedSetsAndVolume: '—', accountIframeCount: 0 };
  });
  const context = await newContext();
  const emptyAccount = await register(context, 'empty');
  await seedWorkbench(context, emptyAccount.id, emptyWorkbench());
  const page = await newPage(context);
  await check('new-real-account-has-missing-summary-and-honest-workbench-chart-empty-states', async () => {
    await page.goto(base); await expect(page.locator('.sync-summary')).toContainText('Records synced');
    await openStatistics(page); await expectSummary(page, ['—', '—', '—', '—']);
    await expect(page.locator('.demo-caption')).toHaveCount(0);
    const { frame } = await embeddedStatistics(page, emptyAccount.id);
    await expect(sourceWorkouts(frame)).toHaveText('0');
    await expect(card(frame, 'Body weight').getByText('No data yet', { exact: true })).toBeVisible();
    await expect(card(frame, 'Exercise progress')).toContainText('Finish your first workout and your progress curves will show up here.');
    await expect(frame.getByRole('heading', { name: 'Recent workouts', exact: true })).toHaveCount(0);
    await expect(frame.locator('.hm-grid [role="button"]')).toHaveCount(0);
    assert.equal((await nativeState(context, emptyAccount.id)).state.workouts.length, 0);
    assert.equal((await workbenchState(context, emptyAccount.id)).state.workouts.length, 0);
    await screenshot(page, 'statistics-empty-account.png', frame);
    const originalProfile = (await nativeState(context, emptyAccount.id)).state.profile;
    const micro: Workout = { id: randomUUID(), date: day, name: 'Synthetic micro-value boundary', duration: 0.000001, rpe: null, notes: '', source: 'manual', createdAt: new Date(started).toISOString(),
      exercises: [{ id: randomUUID(), name: 'Synthetic boundary movement', sets: 1, reps: 1, weight: 0,
        setLogs: [{ id: randomUUID(), kind: 'work', reps: 1, weight: 0, durationSeconds: null, distanceMeters: null, rpe: null, rir: null, completed: true, completedAt: new Date(started).toISOString() }] }] };
    await mutateNative(context, emptyAccount.id, 'workouts', micro.id, micro);
    await page.getByRole('button', { name: 'Refresh summaries', exact: true }).click();
    await expectSummary(page, ['1', '<0.001', '1', '0']);
    micro.exercises[0].weight = 0.000001;
    micro.exercises[0].setLogs![0].weight = 0.000001;
    await mutateNative(context, emptyAccount.id, 'workouts', micro.id, micro);
    await page.getByRole('button', { name: 'Refresh summaries', exact: true }).click();
    await expectSummary(page, ['1', '<0.001', '1', '<0.001']);
    await expect(page.locator('[data-stat="known-volume"] small')).toHaveText('kg × reps; known values only');
    await mutateNative(context, emptyAccount.id, 'profile', 'profile', { ...originalProfile, units: 'imperial' });
    await page.getByRole('button', { name: 'Refresh summaries', exact: true }).click();
    await expectSummary(page, ['1', '<0.001', '1', '<0.001']);
    await expect(page.locator('[data-stat="known-volume"] small')).toHaveText('lb × reps; known values only');
    await screenshot(page, 'statistics-micro-values.png', frame);
    // Restore the same empty account before its later cross-account regression.
    await mutateNative(context, emptyAccount.id, 'workouts', micro.id);
    await mutateNative(context, emptyAccount.id, 'profile', 'profile', originalProfile);
    await page.getByRole('button', { name: 'Refresh summaries', exact: true }).click();
    await expectSummary(page, ['—', '—', '—', '—']);
    assert.equal((await nativeState(context, emptyAccount.id)).state.workouts.length, 0);
    assert.equal((await workbenchState(context, emptyAccount.id)).state.workouts.length, 0);
    return { accountSummaryMissing: true, sourceWorkouts: 0, sourceChartsEmpty: true, noDemoAdoption: true, explicitZeroVolumeKept: true, microPositiveKgAndLbUseThreshold: '<0.001', microPositiveDurationNotRoundedToZero: true, emptyFixtureRestored: true };
  });
  await page.goto('about:blank');
  assert.equal((await context.request.post(base + '/api/auth/logout', { headers: headers(emptyAccount.id), data: {} })).status(), 200);
  const populated = await register(context, 'populated');
  await seedPopulatedAccount(context, populated.id);
  await check('native-and-projected-facts-are-counted-once-with-clear-source-scope-and-real-metric-switches', async () => {
    await page.goto(base); await expect(page.locator('.sync-summary')).toContainText('Records synced');
    await openStatistics(page); await expectSummary(page, ['2', '50', '3', '1,080']);
    await expect(page.locator('[data-training-summary]')).toContainText('The charts and details below use original workbench records only. Native Forma entries and other imports are not copied back into workbench details.');
    await expect(page.locator('[data-stat="known-volume"] small')).toHaveText('kg × reps; known values only');
    const { frame } = await embeddedStatistics(page, populated.id);
    await expect(page.getByRole('heading', { name: 'Training workbench statistics', exact: true })).toBeVisible();
    await expect(sourceWorkouts(frame)).toHaveText('1');
    await expect(frame.getByText(NATIVE_NAME, { exact: true })).toHaveCount(0);
    for (const title of ['Activity (last 12 months)', /^Muscle balance\b/, 'Weekly muscle volume', 'Exercise progress', 'Body weight', 'Recent workouts']) {
      await expect(frame.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
    await expect(frame.getByText(WORKBENCH_NAME, { exact: true })).toBeVisible();
    const activity = card(frame, 'Activity (last 12 months)');
    await expect(activity.getByRole('button', { name: 'Time', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await activity.getByRole('button', { name: 'Volume', exact: true }).click();
    await expect(activity.getByRole('button', { name: 'Volume', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(activity.locator('.hm-legend')).toContainText('Less volume');
    await expect.poll(async () => (await workbenchState(context, populated.id)).state.heatmapMetric).toBe('vol');
    const progress = card(frame, 'Exercise progress');
    await expect(progress.getByText('30 kg', { exact: true })).toBeVisible();
    await progress.getByRole('button', { name: 'Est. 1RM', exact: true }).click();
    await expect(progress.getByRole('button', { name: 'Est. 1RM', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(progress).toContainText('Estimated 1RM per workout');
    await expect(progress.getByText('36 kg', { exact: true })).toBeVisible();
    await screenshot(page, 'statistics-populated-metrics.png', frame);
    return { nativeAndProjectedSavedWorkouts: 2, minutes: 50, completedSets: 3, knownVolumeKgReps: 1080, workbenchSourceWorkouts: 1, timeToVolumeSaved: true, topSetKg: 30, estimated1RMKg: 36 };
  });
  await check('original-workbench-home-still-opens-and-trends-shortcut-targets-statistics', async () => {
    await trainingNavigation(page).getByRole('button', { name: 'Training workbench', exact: true }).click();
    await embeddedStatistics(page, populated.id, 'en', '#/home');
    await mainNavigation(page).getByRole('button', { name: 'Trends', exact: true }).click();
    await page.getByRole('button', { name: 'View training statistics', exact: true }).click();
    await expect(trainingNavigation(page).getByRole('button', { name: 'Statistics', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expectSummary(page, ['2', '50', '3', '1,080']);
    await embeddedStatistics(page, populated.id);
    return { originalHomeRoute: '#/home', trendsShortcutRoute: '#/stats', statisticsSelected: true };
  });
  await check('language-remount-preserves-the-account-and-stats-route-with-no-second-account-adoption', async () => {
    await page.getByRole('button', { name: '切换简体中文', exact: true }).click();
    await expect(page.getByRole('heading', { name: '训练工作台统计', exact: true })).toBeVisible();
    const chinese = await embeddedStatistics(page, populated.id, 'zh');
    await expect(chinese.frame.getByRole('heading', { name: '活动（近 12 个月）', exact: true })).toBeVisible();
    await expectSummary(page, ['2', '50', '3', '1,080']);
    await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
    await embeddedStatistics(page, populated.id);
    await expect(page.getByRole('heading', { name: 'Training workbench statistics', exact: true })).toBeVisible();
    await page.goto('about:blank');
    assert.equal((await context.request.post(base + '/api/auth/logout', { headers: headers(populated.id), data: {} })).status(), 200);
    assert.equal((await context.request.post(base + '/api/auth/login', { headers: { Origin: base }, data: { email: emptyAccount.email, password: PASSWORD } })).status(), 200);
    await page.goto(base); await expect(page.locator('.sync-summary')).toContainText('Records synced');
    await openStatistics(page); await expectSummary(page, ['—', '—', '—', '—']);
    const emptyAgain = await embeddedStatistics(page, emptyAccount.id);
    await expect(sourceWorkouts(emptyAgain.frame)).toHaveText('0');
    await expect(emptyAgain.frame.getByText(WORKBENCH_NAME, { exact: true })).toHaveCount(0);
    assert.equal((await nativeState(context, emptyAccount.id)).state.workouts.length, 0);
    return { englishChineseRoutePreserved: '#/stats', populatedAccountPreservedAcrossLanguage: true, singleIframe: true, emptyAccountStillEmptyAfterSameBrowserSwitch: true };
  });
  await check('mobile-390-statistics-and-expand-controls-fit-without-inner-or-outer-overflow', async () => {
    const mobileContext = await newContext(390), mobile = await register(mobileContext, 'mobile');
    await seedPopulatedAccount(mobileContext, mobile.id);
    const mobilePage = await newPage(mobileContext);
    await mobilePage.goto(base); await expect(mobilePage.locator('.sync-summary')).toContainText('Records synced');
    await openStatistics(mobilePage); await expectSummary(mobilePage, ['2', '50', '3', '1,080']);
    const { frame, iframe } = await embeddedStatistics(mobilePage, mobile.id);
    assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const box = await iframe.boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= 391);
    await screenshot(mobilePage, 'statistics-mobile.png', frame);
    await mobilePage.getByRole('button', { name: 'Expand workbench', exact: true }).click();
    await expect(mobilePage.getByRole('button', { name: 'Collapse', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(mobilePage.getByRole('button', { name: 'Refresh summaries', exact: true })).toBeVisible();
    assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await screenshot(mobilePage, 'statistics-mobile-expanded.png', frame);
    return { viewport: '390x844', innerOuterNoHorizontalOverflow: true, expandAndCollapseControls: true, refreshReachable: true };
  });
} finally {
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
  await new Promise<void>(ready => server.close(() => ready()));
  service.close();
  await writeFile(join(out, 'results.json'), JSON.stringify({ results, pageErrors, consoleErrors, forbiddenOrigins, apiErrors, remainingRisk: ['No Safari/iPhone device run', 'Statistics represents one synthetic native and one compatible workbench record; exhaustive chart calculations remain unit/source tests', 'Existing workbench fresh-session and full training flows are covered by the separate 9-group regression'] }, null, 2));
}
assert.deepEqual(pageErrors, []);
assert.deepEqual(consoleErrors, []);
assert.deepEqual(forbiddenOrigins, []);
assert.deepEqual(apiErrors, []);
