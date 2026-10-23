import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { externalCompilerWasm, runtimeModelManifest } from './scripts/build-optimizations.ts';

export default defineConfig({
  base: '/companion-island/',
  plugins: [runtimeModelManifest(), externalCompilerWasm(), react()],
  build: {
    outDir: process.env.FORMA_ISLAND_OUT_DIR || 'dist',
    target: 'es2022',
    sourcemap: false,
  },
});
