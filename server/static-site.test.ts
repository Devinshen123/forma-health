import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createApp } from './app';

test('the built site and client routes load from a hidden worktree without exposing dotfiles or private API data', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'forma-static-site-'));
  const distDir = join(directory, '.hidden-worktree', '网站', 'dist');
  mkdirSync(join(distDir, 'assets'), { recursive: true });
  const html = '<!doctype html><title>Forma synthetic site</title><h1>Forma</h1>';
  writeFileSync(join(distDir, 'index.html'), html);
  writeFileSync(join(distDir, 'assets', 'app.js'), 'console.log("synthetic site");');
  writeFileSync(join(distDir, '.env'), 'SYNTHETIC_PRIVATE_VALUE=do-not-serve');
  const service = createApp({ dataDir: join(directory, 'synthetic-data'), distDir, ai: {} });
  const server = service.app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('forma-static-site-'));
    rmSync(target, { recursive: true, force: true });
  });
  await new Promise<void>(done => server.once('listening', done));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  for (const path of ['/', '/training']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, `the app shell must load at ${path}`);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    assert.equal(await response.text(), html);
  }
  const script = await fetch(base + '/assets/app.js');
  assert.equal(script.status, 200);
  assert.equal(await script.text(), 'console.log("synthetic site");');
  const privateFile = await fetch(base + '/.env');
  const privateBody = await privateFile.text();
  assert.ok(privateFile.status >= 400 || privateBody === html);
  assert.doesNotMatch(privateBody, /SYNTHETIC_PRIVATE_VALUE|do-not-serve/);
  const privateApi = await fetch(base + '/api/state');
  assert.equal(privateApi.status, 401);
  assert.match(privateApi.headers.get('content-type') ?? '', /application\/json/);
});
