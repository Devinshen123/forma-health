// Publish the corresponding source beside the modified training client. This allowlist never
// walks local user data, environment files, dependency trees, original references or media packs.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipStore } from '../vendor/opengym/frontend/src/lib/zip.js';
import { sourceFileAllowed } from './source-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist/training-workbench/source.zip');
const roots = [
  'src', 'server', 'scripts', 'tests', 'public/exercise-content', 'public/licenses',
  'vendor/opengym/frontend/src',
  'vendor/opengym/frontend/index.html', 'vendor/opengym/frontend/package.json',
  'vendor/opengym/frontend/package-lock.json', 'vendor/opengym/frontend/vite.config.js',
  'vendor/opengym/LICENSE', 'vendor/opengym/NOTICE.md',
  'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html',
  'README.md', 'AGENTS.md', '.gitignore', '.gitattributes', '.env.example', 'public/favicon.svg',
  'Dockerfile', '.dockerignore',
  'docs/architecture/training-source-log.md',
  'docs/collaboration/decisions/ADR-training-workbench-20261018.md',
];
const files = new Map();
const walk = name => {
  const path = resolve(root, name);
  if (!path.startsWith(root + sep)) throw Error('Source path escapes the workspace');
  if (!existsSync(path)) throw Error(`Missing corresponding source: ${name}`);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw Error('Source archive does not follow symbolic links');
  if (stat.isDirectory()) {
    for (const child of readdirSync(path).sort()) walk(join(name, child));
    return;
  }
  const normalized = relative(root, path).split(sep).join('/');
  if (/(^|\/)(node_modules|dist|data|reference-sources|\.git|\.wb-tmp)(\/|$)/i.test(normalized) || /^\.env/.test(basename(path)) && normalized !== '.env.example' || /\.(?:db|sqlite|sqlite3|wal|shm|mp4|webp|png|jpe?g|gif)$/i.test(normalized)) throw Error('A private or binary file reached the source allowlist');
  if (!sourceFileAllowed(normalized)) throw Error(`Unexpected non-source file in the source archive: ${normalized}`);
  files.set(normalized, readFileSync(path));
};
for (const name of roots) walk(name);
const description = 'Forma training workbench — corresponding modified source\n\n' +
  'Includes the modified openGym frontend, the Forma session/storage adapter, and build sources.\n' +
  'Retains openGym AGPL-3.0 and MuscleMap MIT notices. See vendor/opengym/NOTICE.md.\n' +
  'User databases, credentials, dependencies and separately licensed exercise media are excluded.\n' +
  'Install root and vendor frontend dependencies from their lockfiles. Supply your own authorized\n' +
  'exercise media using scripts/import-opengym-catalog.mjs before npm run build. See README.md.\n';
files.set('README-SOURCE.txt', Buffer.from(description));
const manifest = [...files].map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }));
files.set('SOURCE-MANIFEST.json', Buffer.from(JSON.stringify({ format: 'forma-corresponding-source-v1', files: manifest }, null, 2) + '\n'));
const archive = await zipStore([...files].map(([name, bytes]) => ({ name, blob: new Blob([bytes]) })));
writeFileSync(output, Buffer.from(await archive.arrayBuffer()));
console.log(`Training source archive: ${files.size} allowlisted files, ${archive.size} bytes. Private data and exercise media excluded.`);
