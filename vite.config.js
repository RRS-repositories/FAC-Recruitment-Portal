import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // In production nginx serves the built site and proxies /api to the intake
    // service on one origin. This mirrors that locally so the form is exercised
    // same-origin in dev too, and CORS never has to exist anywhere.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.ATLAS_PORT || 5010}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2019',
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Keep the rarely-changing vendor code in its own long-cached chunk.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
