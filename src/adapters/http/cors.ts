import type { RequestHandler } from 'express';

/**
 * Minimal opt-in CORS for third-party browser clients of the api.* vhost (configure with
 * CORS_ORIGINS). Camp's own SPA doesn't need it: it calls the API same-origin via app.*\/api.
 */
export function cors(allowedOrigins: readonly string[] = []): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
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
