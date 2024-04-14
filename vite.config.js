import { resolve } from 'path';

export default {
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'Glob3d',
      fileName: 'glob3d',
    },
    rollupOptions: {
      external: ['h3-js', 'lil-gui', 'three', 'three-conic-polygon-geometry'],
    },
  },
};
