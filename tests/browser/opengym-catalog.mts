import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { Server } from 'node:http';
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { createApp } from '../../server/app';
import { catalog } from '../../src/catalog/exercises';
import muscleIndex from '../../src/catalog/opengym-muscles.json';
import { openGymExercises } from '../../src/catalog/opengym';

const root = resolve(import.meta.dirname, '../..');
const output = process.env.FORMA_TEST_OUTPUT;
assert.ok(output, 'Set FORMA_TEST_OUTPUT to an isolated synthetic evidence directory');
const out = resolve(output);
await mkdir(out, { recursive: true });
const fixture = createApp({ dataDir: join(out, 'synthetic-' + randomUUID()), distDir: join(root, 'dist'), secureCookies: false, ai: {} });
// Use an existing trusted local origin; never relax CSRF for a random test port.
// Port 5173 must be free. The lead stops only its own preview before this suite.
const server: Server = fixture.app.listen(5173, '127.0.0.1');
await new Promise<void>((done, reject) => { server.once('listening', done); server.once('error', reject); });
const address = server.address(); assert.ok(address && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-gpu-compositing'] });
const results: { name: string; passed: boolean; evidence?: unknown; error?: string }[] = [];
const errors: string[] = [], consoleErrors: string[] = [];
let expectedNetworkFailures = 0;
let activePage: Page | undefined;

async function account(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
  await context.addInitScript(() => localStorage.setItem('forma-language', 'en'));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) return route.abort();
    return route.continue();
  });
  const registered = await context.request.post(base + '/api/auth/register', { headers: { Origin: 'http://127.0.0.1:5173' }, data: { name: 'Synthetic catalogue QA', email: `catalog-${randomUUID()}@example.test`, password: 'Synthetic-catalogue-password-2026' } });
  assert.equal(registered.status(), 201);
  const { user } = await registered.json();
  const profile = { name: 'Synthetic catalogue QA', goal: 'habits', experience: 'regular', trainingDays: 3, timeMinutes: 30, equipment: 'gym', allergies: '', restrictions: '', language: 'en', units: 'metric', timezone: 'UTC', sleepGoal: 8, cloudConsent: false, aiConsent: false };
  const seeded = await context.request.post(base + '/api/sync', { headers: { Origin: 'http://127.0.0.1:5173', 'X-Forma-Account': user.id }, data: { mutationId: randomUUID(), changes: [{ collection: 'profile', id: 'profile', kind: 'upsert', baseVersion: 0, value: profile }] } });
  assert.equal(seeded.status(), 200);
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('response', async response => {
    if (response.status() >= 400 && new URL(response.url()).pathname.startsWith('/api/')) {
      const body = await response.json().catch(() => ({}));
      console.log('Synthetic API failure', response.status(), new URL(response.url()).pathname, body.error);
    }
  });
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(message.text()); });
  await page.goto(base);
  assert.equal(new URL(page.url()).origin, base);
  await expect(page).toHaveTitle(/Forma/i);
  await expect(page.locator('.sync-summary')).toContainText('Records synced');
  if (width === 1440) await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('button', { name: 'Training', exact: true }).click();
  else await page.getByRole('navigation', { name: 'Mobile navigation', exact: true }).getByRole('button', { name: 'Training', exact: true }).click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  const snapshot = async () => {
    const response = await context.request.get(base + '/api/sync', { headers: { 'X-Forma-Account': user.id } });
    assert.equal(response.status(), 200); return response.json();
  };
  return { context, page, snapshot };
}

async function check(name: string, fn: () => Promise<unknown>) {
  try { const evidence = await fn(); results.push({ name, passed: true, evidence }); console.log('PASS ' + name); }
  catch (error) {
    if (activePage && !activePage.isClosed()) await writeFile(join(out, 'failed-dom.txt'), await activePage.locator('body').ariaSnapshot());
    results.push({ name, passed: false, error: String(error) }); console.log('FAIL ' + name + ': ' + error); throw error;
  }
}

async function select(page: Page, id: string) {
  await page.getByLabel('Search exercises', { exact: true }).fill(id);
  const card = page.locator(`[data-exercise-id="opengym-${id}"]`);
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'View exercise', exact: true }).click();
  await expect(card.locator('ol li').first()).toBeVisible();
  return card;
}

async function play(video: ReturnType<Page['locator']>) {
  assert.equal(await video.getAttribute('autoplay'), null);
  assert.equal(await video.getAttribute('preload'), 'none');
  assert.equal(await video.evaluate((node: HTMLVideoElement) => node.paused), true);
  await video.evaluate((node: HTMLVideoElement) => node.play());
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0.1);
  const metadata = await video.evaluate((node: HTMLVideoElement) => ({ duration: node.duration, width: node.videoWidth, height: node.videoHeight }));
  assert.ok(metadata.duration > 0 && metadata.width > 0 && metadata.height > 0);
  await video.evaluate((node: HTMLVideoElement) => node.pause());
  assert.equal(await video.evaluate((node: HTMLVideoElement) => node.paused), true);
  return metadata;
}

const sourceMuscles = muscleIndex as Record<string, { primary: string[]; secondary: string[] }>;
const metadataFor = (sourceId: string) => sourceMuscles[sourceId];
const expectedMuscleCount = (key: string) => openGymExercises.filter(action => {
  const metadata = metadataFor(action.sourceId!);
  return [...metadata.primary, ...metadata.secondary].includes(key);
}).length;

async function expectResults(page: Page, count: number) {
  await expect(page.getByTestId('exercise-results')).toContainText(`${count.toLocaleString('en-US')} results`);
}

async function maskedScreenshot(page: Page, filename: string) {
  await page.screenshot({ path: join(out, filename), mask: [page.locator('video'), page.locator('.exercise-preview img')], maskColor: '#f7f8fa', animations: 'disabled' });
}

let context: BrowserContext | undefined;
try {
  const desktop = await account(); context = desktop.context;
  const { page } = desktop;
  await check('animation-only-catalogue-keeps-legacy-identities-and-removes-source-controls', async () => {
    await expect(page.getByRole('status').filter({ hasText: '5,632 animated exercises' })).toBeVisible();
    assert.equal(catalog.filter(action => action.source !== 'opengym').length, 884, 'old record identities remain resolvable outside the selection UI');
    assert.ok(catalog.find(action => action.id === 'forma-squat'));
    await expect(page.getByLabel('Exercise source', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Only exercises with animations or demonstrations', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Free Exercise DB', { exact: false })).toHaveCount(0);
    await expect(page.locator('video')).toHaveCount(0);
    await expectResults(page, 5632);
    await expect(page.locator('[data-exercise-id]')).toHaveCount(12);
    assert.ok((await page.locator('[data-exercise-id]').evaluateAll(cards => cards.map(card => card.getAttribute('data-exercise-id')))).every(id => id?.startsWith('opengym-')));
    await expect(page.locator('[data-exercise-id] .exercise-preview img')).toHaveCount(12);
    const first = await page.locator('[data-exercise-id]').first().getAttribute('data-exercise-id');
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    assert.notEqual(await page.locator('[data-exercise-id]').first().getAttribute('data-exercise-id'), first);
    await page.getByLabel('Muscle group', { exact: true }).selectOption('chest');
    await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled();
    await expectResults(page, 905);
    await page.getByLabel('Equipment', { exact: true }).selectOption('barbell');
    assert.ok(await page.locator('[data-exercise-id]').count() > 0);
    await page.getByLabel('Exercise category', { exact: true }).selectOption('strength');
    assert.ok(await page.locator('[data-exercise-id]').count() > 0);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expectResults(page, 5632);
    await page.evaluate(() => window.scrollTo(0, 0));
    await maskedScreenshot(page, 'desktop-library.png');
    return { visibleCount: 5632, historicalIdentitiesRetained: 884, pageSize: 12, sourceControlsRemoved: true, filterResetsPagination: true };
  });
  await check('body-map-primary-secondary-counts-keyboard-clear-and-bilingual-state', async () => {
    const toggle = page.getByRole('button', { name: 'Explore muscles', exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    const map = page.getByRole('region', { name: 'Body muscle map', exact: true });
    await expect(map.getByText('Front', { exact: true })).toBeVisible();
    await expect(map.getByText('Back', { exact: true })).toBeVisible();
    const chest = map.locator('g[role="button"][data-muscle-key="chest"]').first();
    await expect(chest).toHaveAttribute('data-muscle-count', '905');
    await chest.locator('path').first().click();
    await expect(chest).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Muscle group', { exact: true })).toHaveValue('chest');
    await expectResults(page, expectedMuscleCount('chest'));
    for (const id of await page.locator('[data-exercise-id]').evaluateAll(cards => cards.map(card => card.getAttribute('data-exercise-id')!))) {
      const metadata = metadataFor(id.slice('opengym-'.length));
      assert.ok([...metadata.primary, ...metadata.secondary].includes('chest'));
    }
    const primary = openGymExercises.find(action => metadataFor(action.sourceId!).primary.includes('chest'))!;
    const secondary = openGymExercises.find(action => {
      const metadata = metadataFor(action.sourceId!);
      return !metadata.primary.includes('chest') && metadata.secondary.includes('chest');
    })!;
    for (const action of [primary, secondary]) {
      await page.getByLabel('Search exercises', { exact: true }).fill(action.sourceId!);
      await expect(page.locator(`[data-exercise-id="${action.id}"]`)).toBeVisible();
    }
    await page.getByLabel('Search exercises', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Clear muscle filter', exact: true }).click();
    await expect(page.getByLabel('Muscle group', { exact: true })).toHaveValue('');
    await expectResults(page, 5632);
    const trapezius = map.locator('button.muscle-explorer__chip[data-muscle-key="trapezius"]');
    await trapezius.focus();
    await trapezius.press('Enter');
    await expect(trapezius).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Muscle group', { exact: true })).toHaveValue('trapezius');
    await expectResults(page, 525);
    await page.getByLabel('Muscle group', { exact: true }).selectOption('chest');
    await expect(chest).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '切换简体中文', exact: true }).click();
    await expect(page.getByLabel('肌群', { exact: true })).toHaveValue('chest');
    const zhMap = page.getByRole('region', { name: '人体肌群图', exact: true });
    await expect(zhMap.locator('g[role="button"][data-muscle-key="chest"]').first()).toHaveAccessibleName('胸部 · 905 个动作');
    await expect(zhMap.locator('button.muscle-explorer__chip[data-muscle-key="chest"]')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.scrollTo(0, 0));
    await maskedScreenshot(page, 'desktop-muscle-explorer.png');
    await page.getByRole('button', { name: '清除筛选', exact: true }).click();
    await expect(page.getByLabel('肌群', { exact: true })).toHaveValue('');
    await expect(zhMap.locator('g[role="button"][data-muscle-key="chest"]').first()).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
    await page.getByRole('button', { name: 'Explore muscles', exact: true }).click();
    await expect(map).toHaveCount(0);
    return { chestCount: 905, primaryAndSecondaryMatch: [primary.id, secondary.id], keyboardSelection: true, sharedDropdownState: true, bilingualSelectionPreserved: true };
  });
  await check('empty-search-recovers-and-searching-a-later-page-resets-pagination', async () => {
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeEnabled();
    await page.getByLabel('Search exercises', { exact: true }).fill('no-such-synthetic-action-20261018');
    await expect(page.getByText('No matching exercises. Adjust the filters.', { exact: true })).toBeVisible();
    await expect(page.locator('[data-exercise-id]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.getByLabel('Search exercises', { exact: true })).toHaveValue('');
    await expectResults(page, 5632);
    await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled();
    return { noMatches: true, clearRestoresFullLibrary: true, paginationReset: true };
  });
  const samples = [openGymExercises[0], openGymExercises[Math.floor(openGymExercises.length / 2)], openGymExercises.at(-1)!];
  await check('first-middle-last-animations-decode-play-and-pause', async () => {
    const metadata = [];
    for (const exercise of samples) {
      const card = await select(page, exercise.sourceId!);
      assert.equal(await card.locator('img').evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0), true);
      metadata.push({ id: exercise.sourceId, ...await play(card.locator('video')) });
    }
    const media = samples[0].video!;
    const range = await context!.request.get(base + media.src, { headers: { Range: 'bytes=0-1023' } });
    assert.equal(range.status(), 206); assert.equal((await range.body()).length, 1024);
    return { metadata, rangeRequests: true };
  });
  await check('chinese-name-search-and-explicit-english-step-fallback', async () => {
    await page.getByRole('button', { name: '切换简体中文', exact: true }).click();
    await page.getByLabel('搜索动作', { exact: true }).fill(openGymExercises[0].nameZh!);
    const first = page.locator('[data-exercise-id="opengym-0001"]');
    await expect(first.getByRole('heading', { name: openGymExercises[0].nameZh!, exact: true })).toBeVisible();
    await first.getByRole('button', { name: '查看动作', exact: true }).click();
    await expect(first.locator('ol li').first()).toContainText(/[\u4e00-\u9fff]/);
    const fallback = openGymExercises[Math.floor(openGymExercises.length / 2)];
    const bucket = JSON.parse(await readFile(join(root, 'public', fallback.instructionUrl!), 'utf8'));
    assert.equal(bucket.exercises[fallback.sourceId!].instructionsZh, undefined);
    await page.getByLabel('搜索动作', { exact: true }).fill(fallback.sourceId!);
    const card = page.locator(`[data-exercise-id="${fallback.id}"]`);
    await card.getByRole('button', { name: '查看动作', exact: true }).click();
    await expect(card.getByText('动作步骤保留来源英文，尚无中文版本。', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
    return { chineseSearch: true, originalTranslations: true, fallbackDisclosed: true };
  });
  await check('instruction-and-video-failures-have-working-retry-controls', async () => {
    await page.getByLabel('Search exercises', { exact: true }).fill('0001');
    const card = page.locator('[data-exercise-id="opengym-0001"]');
    let failContent = true, failVideo = true;
    await page.route('**/exercise-content/opengym/1.json', route => { if (failContent) { failContent = false; expectedNetworkFailures++; return route.abort(); } return route.fallback(); });
    await page.route('**/exercise-media/opengym/clip/0001.mp4', route => { if (failVideo) { failVideo = false; expectedNetworkFailures++; return route.abort(); } return route.fallback(); });
    await card.getByRole('button', { name: 'View exercise', exact: true }).click();
    await card.getByRole('button', { name: 'Retry instructions', exact: true }).click();
    await expect(card.locator('ol li').first()).toBeVisible();
    await card.locator('video').evaluate((node: HTMLVideoElement) => node.play().catch(() => undefined));
    await card.getByRole('button', { name: 'Retry animation', exact: true }).click();
    await card.locator('video').evaluate((node: HTMLVideoElement) => node.play());
    await expect.poll(() => card.locator('video').evaluate((node: HTMLVideoElement) => node.videoWidth)).toBeGreaterThan(0);
    await card.locator('video').evaluate((node: HTMLVideoElement) => node.pause());
    await page.unroute('**/exercise-content/opengym/1.json');
    await page.unroute('**/exercise-media/opengym/clip/0001.mp4');
    return { contentRetry: true, videoRetry: true };
  });
  await check('licensed-action-can-be-saved-in-a-routine-and-used-during-training', async () => {
    const card = page.locator('[data-exercise-id="opengym-0001"]');
    await card.getByRole('button', { name: 'Add to routine', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Routine name', { exact: true }).fill('Synthetic licensed catalogue routine');
    await dialog.getByRole('button', { name: 'Save routine', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    let snapshot = await desktop.snapshot();
    assert.equal(snapshot.state.routines[0].exercises[0].exerciseId, 'opengym-0001');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByText('Demonstration and instructions', { exact: true }).click();
    await expect(page.locator('video')).toHaveAttribute('src', '/exercise-media/opengym/clip/0001.mp4');
    await expect(page.locator('.exercise-details ol li').first()).toBeVisible();
    snapshot = await desktop.snapshot();
    assert.equal(snapshot.state.activeWorkouts[0].exercises[0].exerciseId, 'opengym-0001');
    assert.equal(snapshot.state.activeWorkouts[0].exercises[0].setLogs[0].weight, null);
    await page.screenshot({ path: join(out, 'desktop-training.png'), mask: [page.locator('video'), page.locator('.exercise-preview img')], maskColor: '#f7f8fa', animations: 'disabled' });
    return { stableExerciseId: 'opengym-0001', routineSaved: true, activeTeaching: true, actualsRemainUnknown: true };
  });
  await context.close(); context = undefined;
  await check('mobile-library-keeps-video-controls-visible-without-overflow', async () => {
    const mobile = await account(390); context = mobile.context;
    await mobile.page.getByRole('button', { name: 'Explore muscles', exact: true }).click();
    const map = mobile.page.getByRole('region', { name: 'Body muscle map', exact: true });
    const figures = map.locator('figure');
    await expect(figures).toHaveCount(2);
    for (let index = 0; index < 2; index++) {
      const box = await figures.nth(index).boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= 391, 'both body diagrams fit the mobile width');
    }
    const chest = map.locator('button.muscle-explorer__chip[data-muscle-key="chest"]');
    await chest.scrollIntoViewIfNeeded();
    await chest.click();
    await expect(mobile.page.getByLabel('Muscle group', { exact: true })).toHaveValue('chest');
    await expectResults(mobile.page, 905);
    await chest.focus();
    await chest.press('Space');
    await expect(chest).toHaveAttribute('aria-pressed', 'false');
    await expect(mobile.page.getByLabel('Muscle group', { exact: true })).toHaveValue('');
    const hamstring = map.locator('g[role="button"][data-muscle-key="hamstring"]').first();
    await hamstring.locator('path').first().click();
    await expect(mobile.page.getByLabel('Muscle group', { exact: true })).toHaveValue('hamstring');
    await expectResults(mobile.page, expectedMuscleCount('hamstring'));
    assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await mobile.page.evaluate(() => window.scrollTo(0, 0));
    await maskedScreenshot(mobile.page, 'mobile-muscle-explorer.png');
    await mobile.page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await mobile.page.getByRole('button', { name: 'Explore muscles', exact: true }).click();
    const card = await select(mobile.page, '0001');
    await play(card.locator('video'));
    assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await mobile.page.evaluate(() => window.scrollTo(0, 0));
    await maskedScreenshot(mobile.page, 'mobile-library.png');
    await expect(mobile.page.getByLabel('Exercise source', { exact: true })).toHaveCount(0);
    await expect(mobile.page.getByRole('region', { name: 'Original movement demonstration', exact: true })).toHaveCount(0);
    return { viewport: '390x844', reducedMotion: true, noOverflow: true, frontAndBackFit: true, pointerAndKeyboardSelection: true, actualAnimationDecoded: true };
  });
} finally {
  if (context) await context.close();
  await browser.close();
  await new Promise<void>(done => server.close(() => done()));
  fixture.close();
  await writeFile(join(out, 'results.json'), JSON.stringify({ results, pageErrors: errors, consoleErrors, expectedNetworkFailures }, null, 2));
}
assert.deepEqual(errors, []);
assert.equal(expectedNetworkFailures, 2);
assert.equal(consoleErrors.length, 2, 'only the two deliberately failed requests may log network errors');
assert.ok(consoleErrors.every(message => message.includes('Failed to load resource')));
