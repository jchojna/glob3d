/// <reference types="vitest" />
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'Glob3d',
      fileName: 'glob3d',
    },
    rollupOptions: {
      external: ['h3-js', 'three', 'three-conic-polygon-geometry'],
    },
  },
});
