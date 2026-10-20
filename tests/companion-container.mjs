import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

// No browser, host data directory, env file, existing container or fixed host port.
const exec = promisify(execFile);
const image = 'forma-companion:20261019';
const runId = randomUUID();
const name = 'forma-companion-qa-' + runId;
const volume = name + '-data';
const label = 'com.forma.qa.run';
const root = join(tmpdir(), 'forma-companion-20261019');
await mkdir(root, { recursive: true });
const evidence = await mkdtemp(join(root, 'container-'));
const report = { runId, image, container: name, volume, evidence, steps: [], cleanup: {} };
let createdVolume = false, createdContainer = false;
const pause = ms => new Promise(done => setTimeout(done, ms));
async function docker(...args) {
  const result = await exec('docker', args, { timeout: 90000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
  return result.stdout.trim();
}
function record(name, details = {}) {
  const step = { name, at: new Date().toISOString(), ...details };
  report.steps.push(step);
  console.log(JSON.stringify(step));
}
async function containerInfo() { return JSON.parse(await docker('inspect', name))[0]; }
function assertContainerOwner(info) {
  assert.equal(info.Name, '/' + name);
  assert.equal(info.Config.Labels?.[label], runId, 'refuse to alter a container that does not belong to this run');
  assert.equal(info.Config.Labels?.['com.forma.qa.kind'], 'companion-container');
}
function hostPort(info) {
  assertContainerOwner(info);
  const ports = info.NetworkSettings.Ports['3001/tcp'];
  assert.equal(ports.length, 1); assert.equal(ports[0].HostIp, '127.0.0.1');
  const port = Number(ports[0].HostPort); assert.ok(port > 0 && ![3001, 5173, 8080].includes(port));
  return port;
}
async function ready(port) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      const result = await request(port, '/api/capabilities');
      if (result.status === 200) return;
    } catch { /* A new or restarting owned container may not yet accept TCP. */ }
    await pause(300);
  }
  throw new Error('The owned container did not become HTTP ready within 45 seconds');
}
async function healthy(stage) {
  const deadline = Date.now() + 75000;
  while (Date.now() < deadline) {
    const info = await containerInfo(); assertContainerOwner(info);
    assert.equal(info.State.Running, true, 'the owned container must remain running');
    const health = info.State.Health;
    if (health?.Status === 'healthy') {
      assert.equal(health.Log.at(-1)?.ExitCode, 0);
      record(stage, { dockerHealth: health.Status, lastCheckExitCode: health.Log.at(-1).ExitCode });
      return;
    }
    assert.notEqual(health?.Status, 'unhealthy', 'the real Docker healthcheck failed');
    await pause(1000);
  }
  throw new Error('The owned container did not become Docker healthy within 75 seconds');
}
async function request(port, path, { method = 'GET', body, cookie, account } = {}) {
  const data = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((done, reject) => {
    // Raw HTTP deliberately supplies the wire Host; this simulates a trusted TLS
    // terminator. It does not claim to test an actual certificate or public TLS.
    const req = httpRequest({ hostname: '127.0.0.1', port, path, method, headers: {
      Host: 'forma-preview.example.test', Origin: 'https://forma-preview.example.test', 'X-Forwarded-Proto': 'https',
      ...(data === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }),
      ...(cookie ? { Cookie: cookie } : {}), ...(account ? { 'X-Forma-Account': account } : {}),
    } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', part => { text += part; });
      res.on('end', () => {
        try { done({ status: res.statusCode, headers: res.headers, body: JSON.parse(text) }); }
        catch { reject(new Error('Container API returned non-JSON data')); }
      });
    });
    req.on('error', reject); req.setTimeout(10000, () => req.destroy(new Error('Container API request timed out')));
    req.end(data);
  });
}

try {
  const imageInfo = JSON.parse(await docker('image', 'inspect', image))[0];
  assert.equal(imageInfo.Config.User, 'node');
  record('local-image', { imageId: imageInfo.Id, configuredUser: imageInfo.Config.User });
  assert.equal(await docker('volume', 'create', '--label', `${label}=${runId}`, '--label', 'com.forma.qa.kind=companion-container', volume), volume);
  createdVolume = true;
  await docker('run', '--pull=never', '--detach', '--name', name, '--label', `${label}=${runId}`, '--label', 'com.forma.qa.kind=companion-container',
    '--publish', '127.0.0.1::3001', '--mount', `type=volume,source=${volume},target=/var/lib/forma`,
    '--env', 'NODE_ENV=production', '--env', 'FORMA_TRUST_PROXY_HOPS=1', image);
  createdContainer = true;
  const info = await containerInfo(); assertContainerOwner(info);
  let port = hostPort(info);
  const mount = info.Mounts.find(item => item.Destination === '/var/lib/forma');
  assert.equal(mount?.Type, 'volume'); assert.equal(mount?.Name, volume);
  record('isolated-listener', { host: '127.0.0.1', port, persistentMount: mount.Destination });
  await ready(port);
  const runtime = JSON.parse(await docker('exec', name, 'node', '-e', `const fs=require('node:fs');console.log(JSON.stringify({uid:process.getuid(),version:process.version,nodeEnv:process.env.NODE_ENV,dataDir:process.env.FORMA_DATA_DIR,trustProxy:process.env.FORMA_TRUST_PROXY_HOPS,appDataExists:fs.existsSync('/app/data'),envFiles:fs.readdirSync('/app').filter(n=>n==='.env'||n.startsWith('.env.'))}))`));
  assert.notEqual(runtime.uid, 0); assert.match(runtime.version, /^v24\./);
  assert.equal(runtime.nodeEnv, 'production'); assert.equal(runtime.dataDir, '/var/lib/forma'); assert.equal(runtime.trustProxy, '1');
  assert.equal(runtime.appDataExists, false); assert.deepEqual(runtime.envFiles, []);
  record('nonroot-production-runtime', runtime);
  await healthy('initial-healthcheck');

  const password = 'Synthetic container QA ' + randomUUID();
  const registered = await request(port, '/api/auth/register', { method: 'POST', body: { name: 'Synthetic container companion', email: `container-${runId}@example.test`, password } });
  assert.equal(registered.status, 201);
  const setCookie = registered.headers['set-cookie']?.[0]; assert.ok(setCookie);
  // Boolean checks prevent an assertion failure from rendering the cookie value.
  assert.ok(/HttpOnly/i.test(setCookie), 'Session cookie must be HttpOnly');
  assert.ok(/Secure/i.test(setCookie), 'Session cookie must be Secure');
  assert.ok(/SameSite=Strict/i.test(setCookie), 'Session cookie must be SameSite Strict');
  const cookie = setCookie.split(';')[0], account = registered.body.user.id;
  const auth = { cookie, account };
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const profile = { name: 'Synthetic container companion', goal: 'habits', experience: 'regular', trainingDays: 3, timeMinutes: 30, equipment: 'gym', allergies: '', restrictions: '', language: 'en', units: 'metric', timezone, sleepGoal: 8, cloudConsent: false, aiConsent: false };
  const saved = await request(port, '/api/sync', { ...auth, method: 'POST', body: { mutationId: randomUUID(), changes: [{ collection: 'profile', id: 'profile', baseVersion: 0, kind: 'upsert', value: profile }] } });
  assert.equal(saved.status, 200);
  const rest = await request(port, '/api/companion/rest', { ...auth, method: 'POST', body: {} });
  assert.equal(rest.status, 200); assert.equal(rest.body.xp, 10); assert.equal(rest.body.activeDays, 1);
  const rewardDay = rest.body.day;
  record('https-proxy-registration-and-rest', { status: rest.status, xp: rest.body.xp, rewardDay, timezone, secureHttpOnlyCookie: true });

  assertContainerOwner(await containerInfo());
  await docker('restart', '--time', '10', name);
  const previousPort = port;
  port = hostPort(await containerInfo());
  record('restart-listener', { host: '127.0.0.1', port, previousPort });
  await ready(port); await healthy('restart-healthcheck');
  const restored = await request(port, '/api/companion', auth);
  assert.equal(restored.status, 200); assert.equal(restored.body.xp, 10); assert.equal(restored.body.activeDays, 1);
  assert.equal(restored.body.day, rewardDay, 'rerun this narrow smoke if the UTC day changed during it');
  const replay = await request(port, '/api/companion/rest', { ...auth, method: 'POST', body: {} });
  assert.equal(replay.status, 200); assert.equal(replay.body.xp, 10);
  const exported = await request(port, '/api/export', auth);
  assert.equal(exported.status, 200); assert.equal(exported.body.user.id, account);
  assert.equal(exported.body.companion.xp, 10); assert.equal(exported.body.companion.rewards.length, 1);
  assert.equal(exported.body.companion.rewards[0].quest, 'movement');
  record('restart-cookie-and-ledger-persistence', { xp: restored.body.xp, replayXp: replay.body.xp, exportedOwnRewards: exported.body.companion.rewards.length });
  const deleted = await request(port, '/api/account', { ...auth, method: 'DELETE', body: { password } });
  assert.equal(deleted.status, 200);
  assert.equal((await request(port, '/api/companion', auth)).status, 401);
  record('synthetic-account-deleted', { oldCookieRejected: true });
  report.passed = true;
} catch (error) {
  report.passed = false;
  // Error text contains only our assertions or Docker failures; never include HTTP
  // bodies, cookies, credentials, exported health records or raw server logs.
  report.error = error instanceof Error ? error.message : 'Container smoke failed';
  process.exitCode = 1;
} finally {
  try {
    if (createdContainer) {
      assertContainerOwner(await containerInfo());
      await docker('rm', '--force', name);
      report.cleanup.containerRemoved = true;
    }
    if (createdVolume) {
      const owned = JSON.parse(await docker('volume', 'inspect', volume))[0];
      assert.equal(owned.Name, volume); assert.equal(owned.Labels?.[label], runId);
      assert.equal(owned.Labels?.['com.forma.qa.kind'], 'companion-container');
      await docker('volume', 'rm', volume);
      report.cleanup.volumeRemoved = true;
    }
  } catch (error) {
    report.cleanup.error = error instanceof Error ? error.message : 'Owned-resource cleanup failed';
    process.exitCode = 1; report.passed = false;
  }
  await writeFile(join(evidence, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, cleanup: report.cleanup, evidence }));
}
