import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { COMPANION_CHARACTERS } from '../src/companion';

test('new companion art invalidates the shell and an old retained cache cannot shadow current art', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'forma-companion-cache-'));
  t.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  });
  mkdirSync(join(directory, 'dist/assets'), { recursive: true });
  mkdirSync(join(directory, 'dist/companions'));
  writeFileSync(join(directory, 'dist/index.html'), '<html>synthetic cache fixture</html>');
  writeFileSync(join(directory, 'dist/assets/test.js'), '/* synthetic */');
  for (const id of COMPANION_CHARACTERS) for (const suffix of ['', '-thumb'])
    writeFileSync(join(directory, 'dist/companions', id + suffix + '.webp'), 'synthetic first art');
  const build = () => {
    execFileSync(process.execPath, [resolve(import.meta.dirname, '../scripts/build-offline-shell.mjs')], { cwd: directory });
    return readFileSync(join(directory, 'dist/sw.js'), 'utf8');
  };
  const oldShell = build();
  writeFileSync(join(directory, 'dist/companions/bunny.webp'), 'synthetic revised art');
  const shell = build();
  assert.notEqual(shell.match(/forma-shell-[a-f0-9]+/)?.[0], oldShell.match(/forma-shell-[a-f0-9]+/)?.[0]);

  const origin = 'https://synthetic.forma.test';
  const currentCache = shell.match(/forma-shell-[a-f0-9]+/)![0];
  const handlers = new Map<string, (event: any) => void>();
  let installed: Request[] = [], activeReads = 0, globalReads = 0, networkReads = 0;
  class WorkerRequest extends Request {
    constructor(input: string | URL | Request, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, origin) : input, init); }
  }
  runInNewContext(shell, {
    self: { location: { origin }, addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler), clients: { claim: async () => {} } },
    Request: WorkerRequest, URL, Response,
    caches: {
      // The global match would return an older retained cache's art.
      match: async () => { globalReads++; return new Response('stale art'); },
      open: async (name: string) => {
        assert.equal(name, currentCache);
        return {
          addAll: async (requests: Request[]) => { installed = requests; },
          match: async () => { activeReads++; return new Response('current art'); },
        };
      },
    },
    fetch: async () => { networkReads++; return new Response('network'); },
  });
  let install: Promise<unknown> | undefined;
  handlers.get('install')!({ waitUntil: (work: Promise<unknown>) => { install = work; } });
  await install;
  for (const id of COMPANION_CHARACTERS) for (const suffix of ['', '-thumb']) {
    const request = installed.find(req => new URL(req.url).pathname === `/companions/${id}${suffix}.webp`);
    assert.ok(request, 'all twelve public portraits must be precached');
    assert.equal(request.cache, 'reload', 'install must revalidate fixed image URLs against the network');
  }
  let reply: Promise<Response> | undefined;
  handlers.get('fetch')!({ request: new Request(origin + '/companions/bunny.webp'), respondWith: (work: Promise<Response>) => { reply = work; } });
  assert.equal(await (await reply!).text(), 'current art');
  assert.equal(activeReads, 1); assert.equal(globalReads, 0); assert.equal(networkReads, 0);
  handlers.get('fetch')!({ request: new Request(origin + '/companions/bunny.webp?v=pokemon-20261022'), respondWith: (work: Promise<Response>) => { reply = work; } });
  assert.equal(await (await reply!).text(), 'current art', 'versioned portraits must work offline with the matching current cache');
  assert.equal(activeReads, 2); assert.equal(globalReads, 0); assert.equal(networkReads, 0);
  for (const path of ['/api/companion', '/api/assets/private', '/training-workbench/api/media']) {
    let intercepted = false;
    handlers.get('fetch')!({ request: new Request(origin + path), respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, 'private requests must never enter static cache handling');
  }
});
