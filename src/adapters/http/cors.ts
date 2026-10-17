import type { RequestHandler } from 'express';

/**
 * Minimal CORS for the split-vhost setup: the SPA on app.<domain> calls the API on api.<domain>
 * with credentials (the session cookie). We allow:
 *   - the sibling "app." origin of whatever host the API was reached on (zero config), and
 *   - any explicitly configured extra origins (e.g. the Vite dev server).
 */
export function cors(extraOrigins: readonly string[] = []): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isAllowed(origin, req.headers.host, extraOrigins)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '600');
        res.status(204).end();
        return;
      }
    }
    next();
  };
}

function isAllowed(origin: string, apiHost: string | undefined, extra: readonly string[]): boolean {
  if (extra.includes(origin)) return true;
  if (!apiHost) return false;
  try {
    const url = new URL(origin);
    // api.example.com:3000 -> app.example.com:3000
    return url.host === apiHost.replace(/^api\./, 'app.');
  } catch {
    return false;
  }
}
