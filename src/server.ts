/**
 * Entrypoint: wires adapters into the domain and serves three vhosts from ONE HTTP server/port:
 *
 *   app.*  -> React SPA (static build from web/dist)
 *   api.*  -> REST API adapter
 *   mcp.*  -> MCP adapter (Streamable HTTP at /mcp)
 *
 * *.localhost resolves to 127.0.0.1 on most systems (RFC 6761), so http://app.localhost:3000
 * works with no /etc/hosts changes.
 */
import express from 'express';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vhost from 'vhost';
import { createApiApp } from './adapters/http/apiApp.js';
import { createWebApp } from './adapters/http/webApp.js';
import { createMcpApp } from './adapters/mcp/httpApp.js';
import { DEFAULT_DB_FILE, openCamp } from './compose.js';
import type { Camp } from './domain/index.js';

export interface ServerConfig {
  webDist: string;
  corsOrigins: string[];
  secureCookies: boolean;
}

type VhostHandler = Parameters<typeof vhost>[1];

export function buildRootApp(camp: Camp, config: ServerConfig): express.Express {
  const root = express();
  root.disable('x-powered-by');
  // Match on the first DNS label so any base domain works (app.localhost, app.camp.example.com, ...).
  // (vhost anchors patterns at both ends, hence the trailing .+$.)
  root.use(vhost(/^app\..+$/, createWebApp(config.webDist) as unknown as VhostHandler));
  root.use(
    vhost(
      /^api\..+$/,
      createApiApp(camp, { corsOrigins: config.corsOrigins, secureCookies: config.secureCookies }) as unknown as VhostHandler,
    ),
  );
  root.use(vhost(/^mcp\..+$/, createMcpApp(camp) as unknown as VhostHandler));

  // Any other Host (e.g. plain localhost): explain where things live.
  root.use((req, res) => {
    const port = req.headers.host?.split(':')[1];
    const suffix = port ? `:${port}` : '';
    res
      .status(404)
      .type('text/plain')
      .send(
        'Camp serves three virtual hosts on this port:\n\n' +
          `  http://app.localhost${suffix}/      web app\n` +
          `  http://api.localhost${suffix}/      REST API\n` +
          `  http://mcp.localhost${suffix}/mcp   MCP (Streamable HTTP)\n\n` +
          'If your resolver lacks *.localhost support, send the Host header explicitly, e.g.\n' +
          `  curl -H "Host: api.localhost" http://127.0.0.1${suffix}/health\n`,
      );
  });
  return root;
}

function main(): void {
  const port = Number(process.env.PORT ?? 3000);
  const { camp } = openCamp(DEFAULT_DB_FILE);
  const config: ServerConfig = {
    webDist: process.env.WEB_DIST ?? fileURLToPath(new URL('../web/dist', import.meta.url)),
    corsOrigins: (process.env.CORS_ORIGINS ?? `http://localhost:5173,http://app.localhost:5173`)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    secureCookies: process.env.SECURE_COOKIES === 'true',
  };
  const app = buildRootApp(camp, config);
  app.listen(port, () => {
    console.log(`Camp listening on port ${port} (database: ${DEFAULT_DB_FILE})`);
    console.log(`  web  http://app.localhost:${port}/`);
    console.log(`  api  http://api.localhost:${port}/`);
    console.log(`  mcp  http://mcp.localhost:${port}/mcp`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
