import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev: `npm run dev:web` serves the SPA with HMR on :5173 and proxies /api to the backend's api.*
// vhost (start it with `npm run dev`). Prod: `npm run build` emits web/dist, served by app.*.
const backend = process.env.CAMP_BACKEND ?? 'http://127.0.0.1:3000';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['.localhost'],
    proxy: {
      '/api': {
        target: backend,
        rewrite: (path) => path.replace(/^\/api/, ''),
        // Route to the api.* vhost regardless of how the backend address resolves.
        headers: { Host: `api.localhost:${new URL(backend).port || '80'}` },
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 800, // Mantine + React in one chunk is fine for an internal tool
  },
});
