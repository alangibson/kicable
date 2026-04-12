import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@kicable/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  define: {
    // Expose VITE_BACKEND_URL to application code as import.meta.env.VITE_BACKEND_URL.
    // When the var is absent/empty, the app uses IndexedDBAdapter (G1 mode).
    // When set, it will point to the local Node.js server (G3+).
  },
});
