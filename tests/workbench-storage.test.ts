import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearWorkbenchCache } from '../src/training/workbench-storage';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const prefix = `forma-workbench:${owner}:`;
function harness(blocked = false) {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const removedDatabases: string[] = [], removedCaches: string[] = [];
  const storage = () => {
    const entries: Record<string, unknown> = { [prefix + 'gym_state_v1']: 'private target', [`forma-workbench:${other}:gym_state_v1`]: 'other account', gym_state_v1: 'standalone app', 'forma-language': 'en' };
    Object.defineProperty(entries, 'removeItem', { value: (key: string) => { delete entries[key]; } });
    return entries;
  };
  const local = storage(), session = storage();
  const fake = {
    localStorage: local, sessionStorage: session, window: { caches: true },
    caches: { keys: async () => [prefix + 'media', `forma-workbench:${other}:media`, 'forma-shell-test'], delete: async (key: string) => { removedCaches.push(key); return true; } },
    indexedDB: {
      databases: async () => [{ name: prefix + 'opengym-media' }, { name: `forma-workbench:${other}:opengym-media` }, { name: 'opengym-media' }],
      deleteDatabase: (name: string) => {
        removedDatabases.push(name);
        const request: { onsuccess?: () => void; onblocked?: () => void } = {};
        queueMicrotask(() => blocked ? request.onblocked?.() : request.onsuccess?.());
        return request;
      },
    },
  };
  for (const [key, value] of Object.entries(fake)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  return { local, session, removedDatabases, removedCaches, restore() { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } } };
}

test('account deletion removes only its workbench local/session/media caches', async () => {
  const h = harness();
  try {
    await clearWorkbenchCache(owner);
    for (const storage of [h.local, h.session]) {
      assert.equal(storage[prefix + 'gym_state_v1'], undefined);
      assert.equal(storage[`forma-workbench:${other}:gym_state_v1`], 'other account');
      assert.equal(storage.gym_state_v1, 'standalone app');
      assert.equal(storage['forma-language'], 'en');
    }
    assert.deepEqual(h.removedDatabases, [prefix + 'opengym-media']);
    assert.deepEqual(h.removedCaches, [prefix + 'media']);
  } finally { h.restore(); }
});

test('blocked workbench cache deletion reports unfinished local cleanup instead of success', async () => {
  const h = harness(true);
  try { await assert.rejects(clearWorkbenchCache(owner), /Close its other training tabs/); }
  finally { h.restore(); }
});

test('an invalid account cache target cannot delete any browser storage', async () => {
  const h = harness();
  try {
    await assert.rejects(clearWorkbenchCache('../'), /Invalid account/);
    assert.equal(h.local[prefix + 'gym_state_v1'], 'private target');
    assert.deepEqual(h.removedDatabases, []); assert.deepEqual(h.removedCaches, []);
  } finally { h.restore(); }
});
