// Forma training workbench build (scripts/build-training-workbench.mjs runs it).
//
// openGym's web app, built with its own Vite and dependencies (this directory's package-lock),
// into Forma's dist/training-workbench/ and served by Forma at /training-workbench/. Unlike the
// upstream config: no service worker (public/ is not copied at all, so public/sw.js never ships),
// no Umami, no mobile flavour, no dev proxy to an openGym server, and the exercise media are
// Forma's own staged copies.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const here = fileURLToPath(new URL('.', import.meta.url))
const outDir = process.env.FORMA_WORKBENCH_OUT_DIR || resolve(here, '../../../dist/training-workbench')

const pkgVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

// The only build-time switches the app reads (lib/exercises.js, lib/demo.js, lib/mobile.js), set
// here and nowhere else: a VITE_* variable in the shell or an .env file cannot turn on the demo,
// the phone build or another media host.
const env = {
  VITE_IMG_BASE: '/exercise-media/opengym/still/',
  VITE_GIF_BASE: '/exercise-media/opengym/clip/',
  VITE_CLIP_EXT: 'mp4',
  VITE_DEMO: '',
  VITE_MOBILE: '',
}

export default defineConfig({
  root: here,
  base: './',
  publicDir: false,
  envDir: resolve(here, 'src/workbench'),
  envPrefix: 'FORMA_WORKBENCH_NEVER_',
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion),
    ...Object.fromEntries(Object.entries(env).map(([k, v]) => ['import.meta.env.' + k, JSON.stringify(v)])),
  },
  plugins: [react()],
  build: {
    outDir,
    emptyOutDir: false,   // the build script clears dist/training-workbench itself, never dist/
    chunkSizeWarningLimit: 1500,
    sourcemap: false,
  },
})
