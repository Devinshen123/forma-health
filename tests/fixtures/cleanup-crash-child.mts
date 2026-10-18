import { writeSync } from 'node:fs';
import { Store } from '../../server/store';
import { parseState } from '../../server/validation';
import type { SyncMutation } from '../../src/types';

// This disposable child exits at an exact application boundary, without running JS cleanup.
// It models abrupt process loss before COMMIT, not an OS crash or physical power failure.
const [mode, directory, ownerId, payload] = process.argv.slice(2);
if (!['cleanup', 'sync'].includes(mode) || !directory || !ownerId || !payload)
  throw new Error('Expected synthetic mode, directory, owner and payload');
const store = new Store(directory);
const originalExec = store.db.exec.bind(store.db);
store.db.exec = (sql: string) => {
  if (sql.trim().toUpperCase() === 'COMMIT') {
    writeSync(1, JSON.stringify({ fault: 'exit-before-commit', mode, exitCode: 73 }) + '\n');
    process.exit(73);
  }
  return originalExec(sql);
};
if (mode === 'cleanup') {
  const { mutationId, assetId } = JSON.parse(payload) as { mutationId: string; assetId: string };
  store.completeAssetCleanup(ownerId, mutationId, assetId);
} else {
  store.sync(ownerId, JSON.parse(payload) as SyncMutation, (_previous, next) => parseState(next));
}
throw new Error('Synthetic pre-COMMIT failpoint was not reached');
