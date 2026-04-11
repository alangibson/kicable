import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
