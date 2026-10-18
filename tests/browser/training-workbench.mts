import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Server } from 'node:http';
import { chromium, expect, type BrowserContext, type Frame, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';
import { createApp } from '../../server/app';
import { openGymExercises } from '../../src/catalog/opengym';

const root = resolve(import.meta.dirname, '../..');
assert.ok(process.env.FORMA_TEST_OUTPUT, 'Set FORMA_TEST_OUTPUT to an external synthetic evidence directory');
const out = resolve(process.env.FORMA_TEST_OUTPUT!);
await mkdir(out, { recursive: true });
// The lead releases only its own preview on this trusted origin before running this suite.
const service = createApp({ dataDir: join(out, 'synthetic-' + randomUUID()), distDir: join(root, 'dist'), secureCookies: false, ai: {} });
const server: Server = service.app.listen(5173, '127.0.0.1');
await new Promise<void>((ready, reject) => { server.once('listening', ready); server.once('error', reject); });
const base = 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-gpu-compositing'] });
const results: { name: string; passed: boolean; evidence?: unknown; error?: string }[] = [];
const pageErrors: string[] = [], consoleErrors: string[] = [], forbiddenOrigins: string[] = [], apiErrors: { path: string; status: number }[] = [];
const expectedAuthFailures: { mode: string; path: string; status?: number }[] = [];
const PASSWORD = 'Synthetic workbench QA password 2026';
const ROUTINE = 'Synthetic A workbench routine';
const CUSTOM = 'Synthetic A custom movement';
const action = openGymExercises.find(item => item.sourceId === '0022')!;
let context: BrowserContext | undefined, activePage: Page | undefined;

async function newContext(width = 1440) {
  const result = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1100 }, timezoneId: 'UTC', reducedMotion: 'reduce', acceptDownloads: true });
  await result.addInitScript(origin => {
    // Opaque about:blank documents are navigation scaffolding, not app pages.
    // They cannot access storage and need no namespace instrumentation.
    if (location.origin !== origin) return;
    localStorage.setItem('forma-language', 'en');
    const audit = { reads: [] as string[], writes: [] as string[], databases: [] as string[] };
    (window as unknown as { __workbenchStorageAudit: typeof audit }).__workbenchStorageAudit = audit;
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem, open = IDBFactory.prototype.open;
    Storage.prototype.getItem = function (key) { audit.reads.push(String(key)); return get.call(this, key); };
    Storage.prototype.setItem = function (key, value) { audit.writes.push(String(key)); return set.call(this, key, value); };
    IDBFactory.prototype.open = function (name, version) {
      audit.databases.push(String(name));
      return version === undefined ? open.call(this, name) : open.call(this, name, version);
    };
  }, base);
  await result.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (url.origin !== base) { forbiddenOrigins.push(url.origin); return route.abort(); }
    }
    return route.continue();
  });
  return result;
}

async function register(context: BrowserContext, label: string) {
  const email = `workbench-${label}-${randomUUID()}@example.test`;
  const response = await context.request.post(base + '/api/auth/register', { headers: { Origin: base }, data: { name: `Synthetic workbench ${label}`, email, password: PASSWORD } });
  assert.equal(response.status(), 201);
  const { user } = await response.json();
  const profile = { name: `Synthetic workbench ${label}`, goal: 'habits', experience: 'regular', trainingDays: 3, timeMinutes: 30, equipment: 'gym', allergies: '', restrictions: '', language: 'en', units: 'metric', timezone: 'UTC', sleepGoal: 8, cloudConsent: false, aiConsent: false };
  const seeded = await context.request.post(base + '/api/sync', { headers: { Origin: base, 'X-Forma-Account': user.id }, data: { mutationId: randomUUID(), changes: [{ collection: 'profile', id: 'profile', kind: 'upsert', baseVersion: 0, value: profile }] } });
  assert.equal(seeded.status(), 200);
  return { ...user, email } as { id: string; name: string; email: string };
}

const headers = (account: string) => ({ Origin: base, 'X-Forma-Account': account });
async function snapshot(context: BrowserContext, account: string) {
  const response = await context.request.get(base + '/training-workbench/api/data', { headers: headers(account) });
  assert.equal(response.status(), 200);
  return response.json();
}
async function seed(context: BrowserContext, account: string, state: Record<string, unknown>) {
  const before = await snapshot(context, account);
  const response = await context.request.put(base + '/training-workbench/api/data', { headers: headers(account), data: { state, stamped: true, baseRev: before.rev, ...(before.wid ? { baseWid: before.wid } : {}) } });
  assert.equal(response.status(), 200);
  return response.json();
}
function emptyWorkbench() {
  return { lang: 'en', theme: 'light', unit: 'kg', body: 'male', routines: [], workouts: [], customEx: [], bodyweight: [], measurements: [], measurementEnabled: ['waist'], customMeasurements: [], week: {}, dayPlan: {}, exWeights: {}, weighIn: false, checkIn: false, _ts: Date.now() };
}

async function openWorkbench(context: BrowserContext, account: string, width = 1440, reuse?: Page) {
  const page = reuse ?? await context.newPage();
  activePage = page; page.setDefaultTimeout(10000);
  if (!reuse) {
    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).pathname.includes('/api/')) apiErrors.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  }
  await page.goto(base);
  await expect(page).toHaveTitle(/Forma/i);
  await expect(page.locator('.sync-summary')).toContainText('Records synced');
  await page.getByRole('navigation', { name: width === 390 ? 'Mobile navigation' : 'Main navigation', exact: true }).getByRole('button', { name: 'Training', exact: true }).click();
  await page.getByRole('button', { name: 'Training workbench', exact: true }).click();
  const iframe = page.locator('iframe[title="Forma training workbench"]');
  await expect(iframe).toBeVisible();
  const frame = await embeddedFrame(page);
  // The child has a fixed bottom tab bar. Bring the whole iframe into the outer
  // scrolling viewport before using that bar; scrolling only the child cannot do it.
  await iframe.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  const viewport = page.viewportSize(); assert.ok(viewport);
  const frameBox = await iframe.boundingBox();
  const tabbarBox = await frame.locator('#tabbar').boundingBox();
  await writeFile(join(out, `iframe-layout-${width}-${account}.json`), JSON.stringify({ viewport, frame: frameBox, tabbar: tabbarBox }, null, 2));
  assert.ok(frameBox && frameBox.height <= viewport.height + 1, 'the embedded workbench must fit the outer viewport to expose its fixed navigation');
  await expect.poll(async () => {
    const box = await iframe.boundingBox();
    return !!box && box.y >= -1 && box.y + box.height <= viewport.height + 1;
  }, { message: 'the full iframe must be scrolled inside the outer viewport before clicking its fixed navigation' }).toBe(true);
  const url = new URL(frame.url());
  assert.equal(url.origin, base); assert.equal(url.pathname, '/training-workbench/');
  assert.equal(url.searchParams.get('account'), account); assert.equal(url.searchParams.get('lang'), 'en');
  await expect(frame.locator('vite-error-overlay')).toHaveCount(0);
  return { page, frame, iframe };
}

async function embeddedFrame(page: Page) {
  const iframe = page.locator('iframe[title="Forma training workbench"]');
  await expect(iframe).toBeVisible();
  const element = await iframe.elementHandle(); assert.ok(element);
  const frame = await element.contentFrame(); assert.ok(frame);
  await expect(frame.locator('#tabbar')).toBeVisible();
  return frame;
}

async function check(name: string, run: () => Promise<unknown>) {
  try { const evidence = await run(); results.push({ name, passed: true, evidence }); console.log('PASS ' + name); }
  catch (error) {
    if (activePage && !activePage.isClosed()) {
      await writeFile(join(out, 'failed-parent-dom.txt'), await activePage.locator('body').ariaSnapshot());
      const frame = activePage.frames().find(item => item.url().includes('/training-workbench/'));
      if (frame) await writeFile(join(out, 'failed-workbench-dom.txt'), await frame.locator('body').ariaSnapshot());
    }
    results.push({ name, passed: false, error: String(error) }); throw error;
  }
}
async function screenshot(page: Page, frame: Frame, name: string) {
  await page.screenshot({ path: join(out, name), mask: [page.locator('img, video'), frame.locator('img, video')], maskColor: '#f7f8fa', animations: 'disabled' });
}
async function route(frame: Frame, hash: string) {
  await frame.evaluate(value => { location.hash = value; }, hash);
  await expect.poll(() => new URL(frame.url()).hash).toBe(hash);
}
const sheet = (frame: Frame) => frame.locator('.sheet').last();
const rowFor = (frame: Frame, name: string) => frame.locator('.item').filter({ has: frame.getByText(name, { exact: true }) }).first();
async function openLibrary(frame: Frame) {
  await frame.locator('#tabbar').getByRole('button', { name: 'Exercises', exact: true }).click();
  // Both the map and library have a Search field; wait for route replacement so
  // a fill cannot target the previous screen just before it is unmounted.
  await expect(frame.getByRole('heading', { name: 'Exercises', exact: true })).toBeVisible();
}
async function openRoutines(frame: Frame) {
  await frame.locator('#tabbar').getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(frame.getByRole('heading', { name: 'Plan', exact: true })).toBeVisible();
  await frame.getByRole('button', { name: 'Routines', exact: true }).click();
  await expect(frame.getByRole('button', { name: 'New routine', exact: true })).toBeVisible();
}
async function closeSheets(frame: Frame) { for (let count = 0; count < 5 && await frame.locator('.sheet, .center, .mviewer').count(); count++) await frame.locator('body').press('Escape'); }
async function fieldByStepper(dialog: Locator, label: string, value: string) {
  const labelPattern = new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
  const field = dialog.locator('.stp-l').filter({ hasText: labelPattern }).locator('..');
  await expect(field.locator('.stp-l')).toHaveText(label);
  await field.locator('input').fill(value);
}
async function audit(frame: Frame) {
  return frame.evaluate(() => (window as unknown as { __workbenchStorageAudit: { reads: string[]; writes: string[]; databases: string[] } }).__workbenchStorageAudit);
}
async function mediaFixture(context: BrowserContext, account: string, color: string) {
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: color } }).png().toBuffer();
  const hash = createHash('sha256').update(bytes).digest('hex');
  const uploaded = await context.request.put(`${base}/training-workbench/api/media/${hash}`, { headers: { ...headers(account), 'Content-Type': 'image/png' }, data: bytes });
  assert.ok(uploaded.status() === 200 || uploaded.status() === 201);
  return { kind: 'image', hash, mime: 'image/png', size: bytes.length, width: 16, height: 16, at: Date.now() };
}

try {
  context = await newContext();
  const accountA = await register(context, 'A');
  await seed(context, accountA.id, emptyWorkbench());
  const desktop = await openWorkbench(context, accountA.id);
  const { page } = desktop;
  let { frame } = desktop;
  let aStorageKeys: string[] = [];
  let accountB: Awaited<ReturnType<typeof register>> | undefined;
  await check('same-origin-session-boot-library-animation-and-muscle-selection', async () => {
    await expect(frame.getByRole('heading', { name: `Hi ${accountA.name}`, exact: true })).toBeVisible();
    await openLibrary(frame);
    await expect(frame.locator('.lib-count')).toContainText(/5,?632 exercises with animations/);
    await frame.getByPlaceholder('Search…', { exact: true }).fill(action.name);
    await rowFor(frame, action.name).click();
    const video = sheet(frame).locator('video');
    await expect(video).toHaveCount(0);
    await sheet(frame).getByRole('button', { name: 'tap to play', exact: true }).click();
    await expect(video).toHaveCount(1);
    await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.videoWidth)).toBeGreaterThan(0);
    await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0.05);
    await sheet(frame).getByRole('button', { name: 'tap to pause', exact: true }).click();
    await expect(video).toHaveCount(0);
    await expect(sheet(frame).getByRole('button', { name: 'tap to play', exact: true })).toBeVisible();
    await closeSheets(frame);
    await frame.getByRole('button', { name: 'By muscle', exact: true }).click();
    await expect(frame.getByRole('heading', { name: 'Explore muscles', exact: true })).toBeVisible();
    const chest = frame.locator('.bodymap path[role="button"][aria-label="Chest"]').first();
    await chest.click();
    await expect(chest).toHaveAttribute('aria-pressed', 'true');
    await expect(frame.getByRole('heading', { name: 'Exercises for Chest', exact: true })).toBeVisible();
    await expect(frame.getByRole('button', { name: /^Chest 905$/ })).toHaveAttribute('aria-pressed', 'true');
    await screenshot(page, frame, 'workbench-desktop-muscles.png');
    assert.equal(context!.serviceWorkers().some(worker => worker.url().includes('/training-workbench/')), false);
    return { embeddedSession: true, catalogue: 5632, animationDecoded: true, chestExercises: 905, independentServiceWorker: false };
  });
  await check('favourites-and-custom-exercises-save-through-the-real-workbench-ui', async () => {
    await openLibrary(frame);
    await frame.getByPlaceholder('Search…', { exact: true }).fill(action.name);
    await rowFor(frame, action.name).click();
    await sheet(frame).getByRole('button', { name: 'Add to favourites', exact: true }).click();
    await expect(sheet(frame).getByRole('button', { name: 'Remove from favourites', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await closeSheets(frame);
    await frame.getByPlaceholder('Search…', { exact: true }).fill('');
    await frame.getByText('Create your own exercise', { exact: true }).click();
    await sheet(frame).getByPlaceholder('Exercise name', { exact: true }).fill(CUSTOM);
    await sheet(frame).getByRole('button', { name: /^chest$/i }).click();
    await sheet(frame).getByRole('button', { name: /^barbell$/i }).click();
    await sheet(frame).getByRole('button', { name: 'Create exercise', exact: true }).click();
    await expect.poll(async () => (await snapshot(context!, accountA.id)).state.customEx.some((item: { n: string }) => item.n === CUSTOM)).toBe(true);
    const saved = await snapshot(context!, accountA.id);
    assert.ok(saved.state.favEx.includes(action.sourceId));
    await closeSheets(frame);
    return { favouritePersisted: true, customExerciseCreatedInUI: true };
  });
  await check('routine-created-configured-and-persisted-in-ui-survives-frame-reload', async () => {
    await openRoutines(frame);
    await frame.getByRole('button', { name: 'New routine', exact: true }).click();
    await frame.locator('.hdr input.input').fill(ROUTINE);
    await frame.locator('.hdr input.input').press('Tab');
    await frame.getByRole('button', { name: 'Add exercise', exact: true }).click();
    await sheet(frame).getByPlaceholder(/^Search .* exercises…$/).fill(action.name);
    await rowFor(frame, action.name).click();
    await fieldByStepper(sheet(frame), 'Sets', '1');
    await fieldByStepper(sheet(frame), 'Reps', '6');
    await fieldByStepper(sheet(frame), 'Weight (kg)', '30');
    await sheet(frame).getByRole('button', { name: 'Add to routine', exact: true }).click();
    await expect.poll(async () => (await snapshot(context!, accountA.id)).state.routines.some((item: { name: string; ex: { sets: number }[] }) => item.name === ROUTINE && item.ex.length === 1 && item.ex[0].sets === 1)).toBe(true);
    aStorageKeys = (await audit(frame)).writes;
    await frame.goto(frame.url());
    frame = await embeddedFrame(page);
    await openRoutines(frame);
    await expect(frame.getByText(ROUTINE, { exact: true })).toBeVisible();
    const saved = (await snapshot(context!, accountA.id)).state;
    assert.ok(saved.favEx.includes(action.sourceId));
    assert.ok(saved.customEx.some((item: { n: string }) => item.n === CUSTOM));
    return { createdAndConfiguredInUI: true, reloadPreservesRoutineFavouriteAndCustomExercise: true };
  });
  await check('actual-set-completion-and-finish-save-project-one-real-workout-into-forma', async () => {
    await frame.locator('#tabbar').getByRole('button', { name: 'Start', exact: true }).click();
    await rowFor(frame, ROUTINE).click();
    const checkbox = frame.getByRole('checkbox', { name: 'Set 1 done', exact: true });
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
    await checkbox.click();
    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
    await closeSheets(frame);
    await frame.getByRole('button', { name: 'Finish', exact: true }).click();
    await sheet(frame).getByRole('button', { name: 'Finish and save', exact: true }).click();
    await expect.poll(async () => (await snapshot(context!, accountA.id)).state.workouts.length).toBe(1);
    const raw = await snapshot(context!, accountA.id);
    assert.equal(raw.state.workouts[0].entries[0].sets[0].done, true);
    assert.equal(raw.state.workouts[0].entries[0].sets[0].w, 30);
    const response = await context!.request.get(base + '/api/sync', { headers: headers(accountA.id) });
    const native = await response.json();
    assert.equal(native.state.workouts.length, 1);
    assert.equal(native.state.workouts[0].exercises[0].setLogs[0].weight, 30);
    assert.equal(native.state.workouts[0].exercises[0].setLogs[0].reps, 6);
    assert.equal(native.state.workouts[0].exercises[0].setLogs[0].completed, true);
    await screenshot(page, frame, 'workbench-completed-training.png');
    await closeSheets(frame);
    await page.getByRole('button', { name: 'Progress', exact: true }).click();
    await expect(page.getByText(ROUTINE, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Correct session', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete session', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Manage in workbench', exact: true }).click();
    frame = await embeddedFrame(page);
    return { realUICheckedSet: true, rawWorkoutCount: 1, formaWorkoutCount: 1, actualKg: 30, actualReps: 6, nativeProgressVisible: true, projectedRecordsManagedInWorkbench: true };
  });
  await check('measurements-bodyweight-and-history-use-real-save-controls', async () => {
    await closeSheets(frame);
    await frame.locator('#tabbar').getByRole('button', { name: 'Stats', exact: true }).click();
    await frame.locator('.card').filter({ has: frame.getByRole('heading', { name: 'Body measurements', exact: true }) }).getByRole('button', { name: 'Open', exact: true }).click();
    await expect(frame.getByRole('heading', { name: 'Body measurements', exact: true })).toBeVisible();
    await frame.getByRole('button', { name: 'Log', exact: true }).click();
    await sheet(frame).getByRole('textbox', { name: 'Waist cm', exact: true }).fill('81.5');
    await sheet(frame).getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(async () => (await snapshot(context!, accountA.id)).state.measurements[0]?.waist).toBe(81.5);
    await frame.locator('#tabbar').getByRole('button', { name: 'Home', exact: true }).click();
    await frame.locator('.card').filter({ has: frame.getByRole('heading', { name: 'Body weight', exact: true }) }).getByRole('button', { name: 'Log', exact: true }).click();
    await sheet(frame).getByLabel('Weight (kg)', { exact: true }).fill('72.4');
    await sheet(frame).getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(async () => (await snapshot(context!, accountA.id)).state.bodyweight[0]?.w).toBe(72.4);
    await frame.locator('#tabbar').getByRole('button', { name: 'Stats', exact: true }).click();
    await frame.getByRole('button', { name: 'History', exact: true }).click();
    await expect(frame.getByRole('heading', { name: 'History', exact: true })).toBeVisible();
    await expect(frame.getByText(ROUTINE, { exact: true })).toBeVisible();
    return { waistCmSavedInUI: 81.5, bodyweightKgSavedInUI: 72.4, loggedSessionVisibleInHistory: true };
  });
  let aDatabases: string[] = [];
  await check('private-photo-fixture-compares-in-ui-and-json-backup-downloads-saved-facts', async () => {
    const first = await mediaFixture(context!, accountA.id, '#336699');
    const second = await mediaFixture(context!, accountA.id, '#996633');
    const saved = (await snapshot(context!, accountA.id)).state;
    const completed = saved.workouts[0]; completed.media = [first];
    const previous = new Date(Date.parse(completed.d + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
    saved.workouts.push({ ...completed, id: 'synthetic-older-photo-session', d: previous, start: completed.start - 86400000, end: completed.end - 86400000, name: 'Synthetic prior photo fixture', media: [second] });
    await seed(context!, accountA.id, { ...saved, _ts: Date.now() });
    const photoState = (await snapshot(context!, accountA.id)).state;
    assert.equal(photoState.workouts.length, 2);
    assert.ok(photoState.workouts.every((workout: { media?: unknown[] }) => workout.media?.length === 1));
    const photosUrl = frame.url().split('#')[0] + '#/progress-photos';
    // The fixture simulates another device. A hash-only navigation keeps the
    // current in-memory copy; reopen the document so boot actually fetches it.
    await frame.goto('about:blank');
    await frame.goto(photosUrl);
    await expect(frame.getByRole('heading', { name: 'Progress photos', exact: true })).toBeVisible();
    await expect(frame.locator('.wmedia-item')).toHaveCount(2);
    await frame.getByRole('button', { name: 'Compare', exact: true }).click();
    await frame.locator('.wmedia-item').nth(0).click();
    await frame.locator('.wmedia-item').nth(1).click();
    await frame.locator('.pp-cta').getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(frame.getByRole('dialog', { name: 'Compare photos', exact: true })).toBeVisible();
    const images = frame.getByRole('dialog', { name: 'Compare photos', exact: true }).locator('img');
    await expect(images).toHaveCount(2);
    await expect.poll(() => images.evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await screenshot(page, frame, 'workbench-photo-comparison-masked.png');
    aDatabases = (await audit(frame)).databases;
    await frame.getByRole('dialog', { name: 'Compare photos', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
    await route(frame, '#/settings/data');
    await expect(frame.getByRole('heading', { name: 'Data & backup', exact: true })).toBeVisible();
    const downloading = page.waitForEvent('download');
    await frame.getByText('Export backup (JSON)', { exact: true }).click();
    const download = await downloading;
    assert.match(download.suggestedFilename(), /backup.*\.json$/);
    const filename = join(out, 'synthetic-workbench-backup.json'); await download.saveAs(filename);
    const backup = JSON.parse(await readFile(filename, 'utf8'));
    assert.ok(backup.routines.some((item: { name: string }) => item.name === ROUTINE));
    assert.equal(backup.measurements[0].waist, 81.5);
    assert.equal(backup.bodyweight[0].w, 72.4);
    assert.equal(backup.workouts.length, 2);
    return { photoFixtures: 'two synthetic 16x16 colours, seeded through private API', comparisonRendered: true, binaryCacheUsed: aDatabases.length > 0, backupDownloadedAndParsed: true, backupIncludesMeasurementsAndCompletedTraining: true };
  });
  await check('switching-accounts-in-one-browser-isolates-state-and-media-storage-and-reopening-restores-only-the-owner', async () => {
    await page.goto('about:blank');
    assert.equal((await context!.request.post(base + '/api/auth/logout', { headers: headers(accountA.id), data: {} })).status(), 200);
    const createdB = await register(context!, 'B'); accountB = createdB;
    const privateB = await mediaFixture(context!, createdB.id, '#339966');
    await seed(context!, createdB.id, { ...emptyWorkbench(), customEx: [{ id: 'c-synthetic-b', n: 'Synthetic B private media', bp: 'chest', eq: 'barbell', custom: true, media: privateB }] });
    const other = await openWorkbench(context!, createdB.id, 1440, page);
    await openRoutines(other.frame);
    await expect(other.frame.getByText(ROUTINE, { exact: true })).toHaveCount(0);
    await openLibrary(other.frame);
    await other.frame.getByPlaceholder('Search…', { exact: true }).fill('Synthetic B private media');
    await rowFor(other.frame, 'Synthetic B private media').click();
    await expect.poll(() => sheet(other.frame).locator('img').evaluateAll(nodes => nodes.some(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
    const bAudit = await audit(other.frame);
    assert.ok(aStorageKeys.some(key => key.includes(accountA.id)), 'account A persistent state writes are namespaced');
    assert.ok(bAudit.reads.some(key => key.includes(createdB.id)), 'account B persistent state reads are namespaced');
    assert.ok(aDatabases.some(name => name.includes(accountA.id)), 'A uses an account-specific IndexedDB');
    assert.ok(bAudit.databases.some(name => name.includes(createdB.id)), 'B uses an account-specific IndexedDB');
    assert.equal(bAudit.databases.some(name => aDatabases.includes(name)), false, 'B never opens the A media database');
    const serverB = await snapshot(context!, createdB.id);
    assert.equal(serverB.state.routines.length, 0); assert.equal(serverB.state.workouts.length, 0);
    assert.equal(serverB.state.measurements.length, 0); assert.equal(serverB.state.bodyweight.length, 0);
    assert.equal(JSON.stringify(serverB.state).includes(CUSTOM), false);
    await page.goto('about:blank');
    assert.equal((await context!.request.post(base + '/api/auth/logout', { headers: headers(createdB.id), data: {} })).status(), 200);
    assert.equal((await context!.request.post(base + '/api/auth/login', { headers: { Origin: base }, data: { email: accountA.email, password: PASSWORD } })).status(), 200);
    const restored = await openWorkbench(context!, accountA.id, 1440, page);
    await openRoutines(restored.frame);
    await expect(restored.frame.getByText(ROUTINE, { exact: true })).toBeVisible();
    assert.equal((await snapshot(context!, accountA.id)).state.workouts.length, 2);
    return { sameBrowserAccountSwitch: true, localStorageNamespaced: true, indexedDBNamespaced: true, noAutomaticAdoptionOfAIntoB: true, ownerReopenPreserved: true };
  });
  await check('cached-private-history-never-renders-before-a-fresh-session-check-after-cookie-switch-or-signout', async () => {
    const otherAccount = accountB; assert.ok(otherAccount);
    const configResponse = await context!.request.get(base + '/training-workbench/api/config', { headers: headers(accountA.id) });
    assert.equal(configResponse.status(), 200);
    const config = await configResponse.json();
    const hasACache = () => page.evaluate(({ prefix, marker }) => {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key?.startsWith(prefix) && localStorage.getItem(key)?.includes(marker)) return true;
      }
      return false;
    }, { prefix: `forma-workbench:${accountA.id}:`, marker: ROUTINE });
    assert.equal(await hasACache(), true, 'the regression starts with A private records genuinely cached in this browser');

    async function attemptWithoutFreshSession(mode: 'different-cookie' | 'signed-out-blocked-me') {
      const direct = await context!.newPage();
      activePage = direct; direct.setDefaultTimeout(10000);
      const mePath = '/training-workbench/api/me';
      let meRequested = 0, releaseMe!: () => void, completed = false;
      const held = new Promise<void>(resolve => { releaseMe = resolve; });
      direct.on('pageerror', error => pageErrors.push(String(error)));
      direct.on('console', message => {
        if (message.type() !== 'error' && message.type() !== 'warning') return;
        const location = message.location().url;
        const expected = location && new URL(location).pathname === mePath && /Failed to load resource/.test(message.text()) &&
          (mode === 'different-cookie' ? /\b40[13]\b/.test(message.text()) : /ERR_FAILED/.test(message.text()));
        if (!expected) consoleErrors.push(message.text());
      });
      direct.on('response', response => {
        const path = new URL(response.url()).pathname;
        if (response.status() < 400 || !path.includes('/api/')) return;
        if (mode === 'different-cookie' && path === mePath && [401, 403].includes(response.status())) expectedAuthFailures.push({ mode, path, status: response.status() });
        else apiErrors.push({ path, status: response.status() });
      });
      await direct.addInitScript(markers => {
        const audit = { privateContentFlashed: false, signedInNavigationFlashed: false, sentinelObserved: false };
        (window as unknown as { __freshSessionGateAudit: typeof audit }).__freshSessionGateAudit = audit;
        new MutationObserver(() => {
          if (document.getElementById('qa-fresh-session-audit-sentinel')) audit.sentinelObserved = true;
          const shownText = document.body?.innerText ?? '';
          if (markers.some(marker => shownText.includes(marker))) audit.privateContentFlashed = true;
          const tabs = document.getElementById('tabbar');
          if (tabs && tabs.getClientRects().length > 0) audit.signedInNavigationFlashed = true;
        }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
      }, [ROUTINE, CUSTOM, 'Synthetic prior photo fixture']);
      // Config is non-private capability data. Keep it available so this test reaches the
      // actual delayed /me check instead of passing accidentally on an earlier config 401.
      await direct.route('**/training-workbench/api/config', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) }));
      await direct.route('**/training-workbench/api/me', async route => {
        meRequested++;
        await held;
        if (mode === 'signed-out-blocked-me') {
          expectedAuthFailures.push({ mode, path: mePath });
          await route.abort('failed');
        } else await route.continue();
      });
      const gateAudit = () => direct.evaluate(() => (window as unknown as { __freshSessionGateAudit: { privateContentFlashed: boolean; signedInNavigationFlashed: boolean; sentinelObserved: boolean } }).__freshSessionGateAudit);
      try {
        await direct.goto(`${base}/training-workbench/?account=${accountA.id}&lang=en#/history`, { waitUntil: 'domcontentloaded' });
        await expect.poll(() => meRequested).toBeGreaterThan(0);
        await direct.evaluate(() => {
          const sentinel = document.createElement('span');
          sentinel.id = 'qa-fresh-session-audit-sentinel';
          sentinel.hidden = true;
          sentinel.textContent = 'QA observer sentinel';
          document.body.appendChild(sentinel);
        });
        await expect.poll(async () => (await gateAudit()).sentinelObserved, { message: 'the privacy observer must detect a non-private DOM mutation before its no-flash result is trusted' }).toBe(true);
        // A controlled delay gives cached state time to render if the session gate regresses.
        // The observer also catches a one-frame disclosure that final DOM checks would miss.
        await direct.evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 400)));
        assert.deepEqual(await gateAudit(), { privateContentFlashed: false, signedInNavigationFlashed: false, sentinelObserved: true });
        await expect(direct.getByText(ROUTINE, { exact: true })).toHaveCount(0);
        await expect(direct.locator('#tabbar')).toHaveCount(0);
        const refused = mode === 'different-cookie' ? direct.waitForResponse(response => new URL(response.url()).pathname === mePath && [401, 403].includes(response.status())) : undefined;
        releaseMe();
        if (refused) await refused;
        await expect(direct.getByRole('alert')).toBeVisible();
        await expect(direct.getByRole('button', { name: 'Back to Forma', exact: true })).toBeVisible();
        await expect(direct.getByText(ROUTINE, { exact: true })).toHaveCount(0);
        await expect(direct.locator('#tabbar')).toHaveCount(0);
        assert.deepEqual(await gateAudit(), { privateContentFlashed: false, signedInNavigationFlashed: false, sentinelObserved: true });
        await screenshot(direct, direct.mainFrame(), `workbench-session-gate-${mode}.png`);
        completed = true;
      } finally {
        releaseMe();
        if (completed) await direct.close();
      }
    }

    await page.goto('about:blank');
    assert.equal((await context!.request.post(base + '/api/auth/logout', { headers: headers(accountA.id), data: {} })).status(), 200);
    assert.equal((await context!.request.post(base + '/api/auth/login', { headers: { Origin: base }, data: { email: otherAccount.email, password: PASSWORD } })).status(), 200);
    await attemptWithoutFreshSession('different-cookie');
    assert.equal((await snapshot(context!, otherAccount.id)).state.workouts.length, 0);
    assert.equal((await context!.request.post(base + '/api/auth/logout', { headers: headers(otherAccount.id), data: {} })).status(), 200);
    assert.equal((await context!.request.post(base + '/api/auth/login', { headers: { Origin: base }, data: { email: accountA.email, password: PASSWORD } })).status(), 200);
    const refreshedA = await openWorkbench(context!, accountA.id, 1440, page);
    await refreshedA.frame.locator('#tabbar').getByRole('button', { name: 'Plan', exact: true }).click();
    await expect(refreshedA.frame.getByText(ROUTINE, { exact: true })).toBeVisible();
    assert.equal(await hasACache(), true, 'A is legitimately re-authenticated and cached before the signed-out case');
    await page.goto('about:blank');
    assert.equal((await context!.request.post(base + '/api/auth/logout', { headers: headers(accountA.id), data: {} })).status(), 200);
    await attemptWithoutFreshSession('signed-out-blocked-me');
    assert.ok(expectedAuthFailures.some(item => item.mode === 'different-cookie' && [401, 403].includes(item.status!)));
    assert.ok(expectedAuthFailures.some(item => item.mode === 'signed-out-blocked-me' && item.status === undefined));

    // An already authenticated tab must also lock without waiting for another API response.
    // A second real Forma page performs the same native control-key write as confirmed logout.
    assert.equal((await context!.request.post(base + '/api/auth/login', { headers: { Origin: base }, data: { email: accountA.email, password: PASSWORD } })).status(), 200);
    await page.goto(base);
    await expect(page.locator('.sync-summary')).toContainText('Records synced');
    const oldTab = await context!.newPage(); activePage = oldTab; oldTab.setDefaultTimeout(10000);
    oldTab.on('pageerror', error => pageErrors.push(String(error)));
    oldTab.on('console', message => {
      if (message.type() !== 'error' && message.type() !== 'warning') return;
      const location = message.location().url;
      if (location && new URL(location).pathname.startsWith('/training-workbench/api/') && /Failed to load resource.*ERR_FAILED/.test(message.text())) return;
      consoleErrors.push(message.text());
    });
    await oldTab.goto(`${base}/training-workbench/?account=${accountA.id}&lang=en#/history`);
    await expect(oldTab.getByRole('heading', { name: 'History', exact: true })).toBeVisible();
    await expect(oldTab.getByText(ROUTINE, { exact: true })).toBeVisible();
    let releaseBlocked!: () => void, blockedReads = 0, locked = false;
    const blocked = new Promise<void>(resolve => { releaseBlocked = resolve; });
    await oldTab.route('**/training-workbench/api/**', async route => {
      blockedReads++;
      await blocked;
      await route.abort('failed').catch(() => undefined);
    });
    try {
      await oldTab.evaluate(account => {
        void fetch('/training-workbench/api/me', { credentials: 'same-origin', headers: { 'X-Forma-Account': account } }).catch(() => undefined);
      }, accountA.id);
      await expect.poll(() => blockedReads).toBeGreaterThan(0);
      assert.equal((await context!.request.post(base + '/api/auth/logout', { headers: headers(accountA.id), data: {} })).status(), 200);
      await page.evaluate(() => localStorage.setItem('forma-session-change', crypto.randomUUID()));
      await expect(oldTab.getByRole('alert')).toBeVisible({ timeout: 2000 });
      await expect(oldTab.getByRole('button', { name: 'Back to Forma', exact: true })).toBeVisible();
      await expect(oldTab.getByText(ROUTINE, { exact: true })).toHaveCount(0);
      await expect(oldTab.locator('#tabbar')).toHaveCount(0);
      expectedAuthFailures.push({ mode: 'open-tab-logout-broadcast-with-api-held', path: '/training-workbench/api/me' });
      locked = true;
    } finally {
      releaseBlocked();
      if (locked) await oldTab.close();
    }
    return { genuineCachedAHistory: true, differentCookieRejected: true, signedOutBlockedCheckClosed: true, continuousNoPrivateFlashAssertion: true, privacyObserverPositiveControl: true, noSignedInNavigationBeforeConfirmation: true, existingPrivateHistoryHiddenByRealLogoutStorageSignalWithoutApiResponse: true };
  });
  await context.close(); context = undefined;
  await check('mobile-390-workbench-and-muscle-library-remain-usable-without-horizontal-overflow', async () => {
    context = await newContext(390);
    const mobileAccount = await register(context, 'mobile');
    await seed(context, mobileAccount.id, emptyWorkbench());
    const mobile = await openWorkbench(context, mobileAccount.id, 390);
    await openLibrary(mobile.frame);
    await mobile.frame.getByRole('button', { name: 'By muscle', exact: true }).click();
    await mobile.frame.locator('.bodymap path[role="button"][aria-label="Chest"]').first().click();
    await expect(mobile.frame.getByRole('heading', { name: 'Exercises for Chest', exact: true })).toBeVisible();
    assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.ok(await mobile.frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const frameBox = await mobile.iframe.boundingBox(); assert.ok(frameBox && frameBox.x >= 0 && frameBox.x + frameBox.width <= 391);
    await screenshot(mobile.page, mobile.frame, 'workbench-mobile-muscles.png');
    await mobile.page.getByRole('button', { name: 'Expand workbench', exact: true }).click();
    await expect(mobile.page.getByRole('button', { name: 'Collapse', exact: true })).toHaveAttribute('aria-pressed', 'true');
    assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.ok(await mobile.frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    return { viewport: '390x844', outerAndInnerNoOverflow: true, musclePointerControl: true, expandControl: true };
  });
} finally {
  if (context) await context.close();
  await browser.close();
  await new Promise<void>(ready => server.close(() => ready()));
  service.close();
  await writeFile(join(out, 'results.json'), JSON.stringify({ results, pageErrors, consoleErrors, forbiddenOrigins, apiErrors, expectedAuthFailures, remainingRisk: ['No Safari/iPhone device run', 'Plan rotation/progression option combinations and backup import/zip were not exhaustively tested', 'Photos are synthetic fixtures; file selection and camera capture are not covered'] }, null, 2));
}
assert.deepEqual(pageErrors, []);
assert.deepEqual(forbiddenOrigins, []);
assert.deepEqual(apiErrors, []);
assert.deepEqual(consoleErrors, []);
