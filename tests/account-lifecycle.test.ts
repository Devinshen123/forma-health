import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertWriteBinding } from '../src/sync/lifecycle';

test('delayed editor bindings reject account changes, reauthentication and replaced engines before saving', () => {
  const engine = {}, original = { epoch: 4, accountId: 'synthetic-A', engine };
  assert.doesNotThrow(() => assertWriteBinding(original, { ...original }));
  for (const current of [
    { ...original, accountId: 'synthetic-B' },
    { ...original, epoch: 5 },
    { ...original, engine: {} },
    { epoch: 5, accountId: undefined, engine: null },
  ]) assert.throws(() => assertWriteBinding(original, current), /Account changed/);
  assert.throws(() => assertWriteBinding({ epoch: 0, accountId: undefined, engine: null }, original), /Account changed/);
});
