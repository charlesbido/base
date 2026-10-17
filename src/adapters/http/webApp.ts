/** Serves the built React SPA (web/dist) on the app.* vhost, with client-side-routing fallback. */
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function createWebApp(distDir: string): express.Express {
  const app = express();
  app.disable('x-powered-by');
  const index = join(distDir, 'index.html');

  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.use((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).end();
      return;
    }
    if (!existsSync(index)) {
      res
        .status(503)
        .type('text/plain')
        .send('The web app has not been built yet. Run `npm run build` (or use `npm run dev:web` for the Vite dev server).\n');
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    // Relative path + root: `send` only applies its dotfile rules to the part below root.
    res.sendFile('index.html', { root: distDir });
  });
  return app;
}
