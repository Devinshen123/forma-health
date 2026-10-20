import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error Build helpers are plain Node ESM, deliberately outside browser TypeScript.
import { sourceFileAllowed } from '../scripts/source-policy.mjs';

test('public corresponding source excludes exports, traces and attachments left alongside code', () => {
  for (const name of ['server/forma-export.json', 'tests/synthetic-accounts.json', 'scripts/request.har', 'server/report.pdf', 'src/meals.csv', 'tests/debug.log', 'src/private.txt', 'server/.env', 'scripts/.env.production', 'data/forma.sqlite', 'src/catalog/forma-export.json', 'public/exercise-content/opengym/64.json', 'src/../data/secrets.ts'])
    assert.equal(sourceFileAllowed(name), false, name);
});
test('corresponding source permits code, fixed catalogs, build configuration and required notices', () => {
  for (const name of ['server/companion.ts', 'src/features/Companion.tsx', 'tests/browser/companion.mts', 'scripts/source-policy.mjs', 'src/companion.css', 'src/catalog/opengym.json', 'public/exercise-content/opengym/0.json', 'public/exercise-content/opengym/63.json', '.env.example', 'Dockerfile', '.dockerignore', 'vendor/opengym/LICENSE', 'public/licenses/opengym-AGPL-3.0.txt'])
    assert.equal(sourceFileAllowed(name), true, name);
});
