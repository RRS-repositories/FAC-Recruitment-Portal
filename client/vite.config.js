import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Scoring and AI detection live outside the client because the server
      // must run the same code, not a copy. See shared/README.md.
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    fs: {
      // shared/ is a sibling of client/, so it sits outside Vite's project
      // root. The alias resolves it fine and `vite build` bundles it fine —
      // but the dev server serves modules over HTTP and refuses anything
      // outside the root, returning 403 with an unhelpful "failed to resolve
      // import". Allowing the repo root is what makes `npm run dev` work.
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
    // The client and API are same-origin in production (nginx serves the build
    // and proxies /api), so mirror that in dev and CORS never has to exist.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.PORT || 5020}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: { manualChunks: { 'react-vendor': ['react', 'react-dom', 'react-router-dom'] } },
    },
  },
});
