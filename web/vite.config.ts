import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev: `npm run dev:web` serves the SPA with HMR on :5173; it calls the API at api.localhost:3000
// (override with VITE_API_URL). Prod: `npm run build` emits web/dist, served by the app.* vhost.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['.localhost'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 800, // Mantine + React in one chunk is fine for an internal tool
  },
});
