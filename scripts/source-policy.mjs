// Publishing source must not pick up an export, trace or attachment accidentally
// left next to code. Non-code data needs a deliberate, exact allowlist entry.
const explicit = new Set([
  'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html',
  'README.md', 'AGENTS.md', '.gitignore', '.gitattributes', '.env.example',
  'Dockerfile', '.dockerignore', 'public/favicon.svg',
  'vendor/opengym/frontend/index.html', 'vendor/opengym/frontend/package.json',
  'vendor/opengym/frontend/package-lock.json', 'vendor/opengym/frontend/vite.config.js',
  'vendor/opengym/LICENSE', 'vendor/opengym/NOTICE.md',
  'docs/architecture/training-source-log.md',
  'docs/architecture/companion-pokemon-reference-20261022.md',
  'docs/collaboration/decisions/ADR-training-workbench-20261018.md',
  'public/licenses/opengym-NOTICE.txt', 'public/licenses/opengym-AGPL-3.0.txt',
  'public/licenses/free-exercise-db-Unlicense.txt',
  'public/licenses/pokemon-models-NOTICE.txt', 'public/licenses/pokemon-assets-MIT.txt', 'public/licenses/pokemon-viewer-MIT.txt',
  'public/licenses/three-MIT.txt', 'public/licenses/draco-Apache-2.0.txt', 'server/README.md',
  'src/catalog/exercises.json', 'src/catalog/opengym.json',
  'src/catalog/opengym-muscles.json', 'src/catalog/opengym-manifest.json',
  'vendor/opengym/frontend/src/lib/catalogue-v13-ids.json',
  'vendor/opengym/frontend/src/lib/exercise-muscle-map.json',
  'vendor/opengym/frontend/src/lib/exercise-muscle-olympic.json',
  'vendor/opengym/frontend/src/lib/exercise-muscle-batch-1.json',
  'vendor/opengym/frontend/src/lib/exercise-muscle-batch-2.json',
]);
export function sourceFileAllowed(name) {
  if (name.includes('\\') || name.split('/').some(part => !part || part === '.' || part === '..')) return false;
  if (/(^|\/)(?:node_modules|dist|data|reference-sources|\.git|\.wb-tmp)(\/|$)/i.test(name)) return false;
  if (explicit.has(name)) return true;
  if (/^public\/exercise-content\/opengym\/(?:[0-9]|[1-5][0-9]|6[0-3])\.json$/.test(name)) return true;
  return /^(?:src|server|scripts|tests|vendor\/opengym\/frontend\/src)\/.+\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|css)$/.test(name)
    && !name.split('/').some(part => part.startsWith('.'));
}
