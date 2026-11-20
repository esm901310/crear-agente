import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Pantallas (Vite + React). En desarrollo, todo lo que empiece con /api
// se manda al servidor local de Cloudflare (npm run dev:api, puerto 8787).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
