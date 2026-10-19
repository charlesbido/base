/**
 * MCP over Streamable HTTP, served on the mcp.* vhost at POST /mcp.
 *
 * Stateless mode: each request gets its own McpServer + transport, bound to the user identified by
 * the `Authorization: Bearer <token>` header — either a 30-day session token (POST api.*\/auth/login)
 * or a long-lived personal access token (POST api.*\/access-tokens), which is the better fit here
 * since this is usually a client config set up once and left alone.
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Request, type Response } from 'express';
import type { Camp } from '../../domain/index.js';
import { createCampMcpServer } from './createServer.js';

function jsonRpcError(res: Response, status: number, message: string): void {
  res.status(status).json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null });
}

export function createMcpApp(camp: Camp): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    res.type('text/plain').send(
      'Camp MCP server (Streamable HTTP, stateless).\n' +
        'POST /mcp with "Authorization: Bearer <session or access token>" and "Accept: application/json, text/event-stream".\n' +
        'Prefer a long-lived personal access token (POST api.*/access-tokens) over a session token here.\n',
    );
  });

  app.post('/mcp', async (req: Request, res: Response) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const me = camp.queries.getCurrentUser({ token });
    if (!me.ok) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return jsonRpcError(res, 401, 'Unauthorized: pass a Camp session or access token as "Authorization: Bearer <token>"');
    }

    const server = createCampMcpServer(camp, me.value);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('MCP request failed', err);
      if (!res.headersSent) jsonRpcError(res, 500, 'Internal server error');
    }
  });

  // Stateless server: no SSE stream to resume and no session to delete.
  app.all('/mcp', (_req, res) => {
    res.setHeader('Allow', 'POST');
    jsonRpcError(res, 405, 'Method not allowed');
  });

  return app;
}
