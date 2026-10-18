#!/usr/bin/env node
// Builds the Forma training workbench (vendor/opengym/frontend, openGym's web app modified for
// Forma) into dist/training-workbench/, served by Forma at /training-workbench/.
//
// Runs after Forma's own `vite build`. It uses the workbench's own Vite and dependencies
// (vendor/opengym/frontend/node_modules, installed from its package-lock by `npm ci` there), so
// Forma's React/Vite versions are not involved. Only dist/training-workbench/ is cleared and
// written; the rest of dist/ is Forma's. A copy of openGym's service worker, an .env, a database
// or test fixtures in the output fails the build.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, statSync, copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const app = join(root, 'vendor', 'opengym', 'frontend')
const outDir = join(root, 'dist', 'training-workbench')
const viteBin = join(app, 'node_modules', 'vite', 'bin', 'vite.js')

const fail = message => { console.error('[training-workbench] ' + message); process.exit(1) }

if (!existsSync(join(app, 'package-lock.json'))) fail('vendor/opengym/frontend/package-lock.json is missing.')
if (!existsSync(viteBin)) fail('The workbench dependencies are not installed. Run `npm ci` in vendor/opengym/frontend first.')

// The output is dist/training-workbench and nothing above it.
const rel = relative(root, outDir)
if (rel !== join('dist', 'training-workbench') || rel.startsWith('..')) fail('Refusing to write outside dist/training-workbench.')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

// A clean environment for the child: no VITE_* from this shell reaches the build (the config sets
// the few it needs itself), and no telemetry switches.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^VITE_/i.test(k)))
env.FORMA_WORKBENCH_OUT_DIR = outDir
env.NODE_ENV = 'production'

const run = spawnSync(process.execPath, [viteBin, 'build', '--config', join(app, 'vite.config.js')], { cwd: app, env, stdio: 'inherit' })
if (run.error) fail(run.error.message)
if (run.status !== 0) fail('vite build exited with ' + run.status)

// Licence and attribution travel with the bundle.
for (const f of ['LICENSE', 'NOTICE.md']) copyFileSync(join(root, 'vendor', 'opengym', f), join(outDir, f))

// What must never be served from here.
const files = []
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p); else files.push(relative(outDir, p).split(sep).join('/'))
  }
}
walk(outDir)
const forbidden = files.filter(f => /(^|\/)(sw\.js|manifest\.json|\.env[^/]*|.*\.(db|sqlite|sqlite3|db-wal|db-shm)|.*\.test\.[cm]?jsx?|test-fixtures?\/.*)$/i.test(f))
if (forbidden.length) fail('Forbidden files in the output: ' + forbidden.join(', '))
if (!files.includes('index.html')) fail('The build wrote no index.html.')

console.log(`[training-workbench] built ${files.length} files into ${relative(root, outDir).split(sep).join('/')}/`)
