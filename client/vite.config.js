import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
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
