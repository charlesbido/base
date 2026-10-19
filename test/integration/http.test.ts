/**
 * End-to-end through the real root app: Host-header vhost dispatch -> REST/MCP adapters ->
 * domain -> SQLite (in-memory). Requests use node:http so we can set the Host header.
 */
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildRootApp } from '../../src/server.js';
import { composeCamp } from '../../src/compose.js';
import { createMcpApp } from '../../src/adapters/mcp/httpApp.js';
import { openDatabase } from '../../src/adapters/sqlite/index.js';
import type { Camp } from '../../src/domain/index.js';

interface Res {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

let server: Server;
let port: number;
let camp: Camp;

function call(host: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
    const req = request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          Host: `${host}:${port}`,
          ...(payload ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed: unknown = data;
          try {
            parsed = JSON.parse(data);
          } catch {
            /* text body */
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const api = (method: string, path: string, body?: unknown, token?: string) =>
  call('api.localhost', method, path, body, token ? { Authorization: `Bearer ${token}` } : {});

beforeAll(async () => {
  const dist = mkdtempSync(join(tmpdir(), 'camp-web-'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Camp</title><div id="root"></div>');
  camp = composeCamp(openDatabase(':memory:'));
  const app = buildRootApp(camp, { webDist: dist, corsOrigins: ['http://localhost:5173'], secureCookies: false });
  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.close();
});

describe('vhost dispatch', () => {
  it('routes by Host header on a single port', async () => {
    expect((await api('GET', '/health')).body).toEqual({ ok: true });
    const app = await call('app.localhost', 'GET', '/projects/123');
    expect(app.status).toBe(200);
    expect(String(app.body)).toContain('<div id="root">');
    expect((await call('mcp.localhost', 'GET', '/')).body).toContain('Camp MCP server');
    // An unrecognized Host (e.g. a reverse proxy/tunnel hostname) falls back to the app,
    // not a dead end, since that's almost always what's wanted.
    const other = await call('localhost', 'GET', '/projects/123');
    expect(other.status).toBe(200);
    expect(String(other.body)).toContain('<div id="root">');
  });

  it('also mounts the API same-origin at app.*/api (first-party session cookie for the SPA)', async () => {
    const reg = await call('app.localhost', 'POST', '/api/auth/register', { email: 'spa@example.com', name: 'Spa', password: 'password123' });
    expect(reg.status).toBe(201);
    const cookie = String(reg.headers['set-cookie']).split(';')[0]!;
    const me = await call('app.localhost', 'GET', '/api/auth/me', undefined, { Cookie: cookie });
    expect(me.body).toMatchObject({ email: 'spa@example.com' });
    // Same session works on the api.* vhost: one API, two mounts.
    expect((await call('api.localhost', 'GET', '/auth/me', undefined, { Cookie: cookie })).status).toBe(200);
    expect((await call('app.localhost', 'GET', '/api/nope')).status).toBe(404);
  });

  it('allows CORS with credentials only from configured origins', async () => {
    const ok = await call('api.localhost', 'OPTIONS', '/projects', undefined, { Origin: 'http://localhost:5173' });
    expect(ok.status).toBe(204);
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const evil = await call('api.localhost', 'GET', '/health', undefined, { Origin: 'http://evil.example' });
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('REST API', () => {
  it('registers, sets a session cookie, and authenticates with it', async () => {
    const reg = await api('POST', '/auth/register', { email: 'cookie@example.com', name: 'Cookie', password: 'password123' });
    expect(reg.status).toBe(201);
    const setCookie = String(reg.headers['set-cookie']);
    expect(setCookie).toMatch(/camp_session=.+HttpOnly/);
    const cookie = setCookie.split(';')[0]!;
    const me = await call('api.localhost', 'GET', '/auth/me', undefined, { Cookie: cookie });
    expect(me.body).toMatchObject({ email: 'cookie@example.com', name: 'Cookie' });
    await call('api.localhost', 'POST', '/auth/logout', undefined, { Cookie: cookie });
    expect((await call('api.localhost', 'GET', '/auth/me', undefined, { Cookie: cookie })).status).toBe(401);
  });

  it('creates a project, adds a to-do, completes it, and reads it back', async () => {
    const { token } = (await api('POST', '/auth/register', { email: 'ada@example.com', name: 'Ada', password: 'password123' })).body;
    await api('POST', '/auth/register', { email: 'bob@example.com', name: 'Bob', password: 'password123' });
    expect((await api('GET', '/projects')).status).toBe(401);

    const project = await api('POST', '/projects', { name: 'Website', actorId: 'spoofed' }, token);
    expect(project.status).toBe(201);
    expect(project.body.createdBy).not.toBe('spoofed');
    const pid = project.body.id;

    const bob = await api('POST', `/projects/${pid}/members`, { email: 'bob@example.com' }, token);
    expect(bob.status).toBe(201);

    const list = (await api('POST', `/projects/${pid}/todolists`, { name: 'Launch' }, token)).body;
    const todo = await api('POST', `/todolists/${list.id}/todos`, { title: 'Write copy', dueDate: '2026-11-01', assigneeId: bob.body.id }, token);
    expect(todo.status).toBe(201);
    expect((await api('POST', `/todos/${todo.body.id}/comments`, { body: 'On it' }, token)).status).toBe(201);
    expect((await api('POST', `/todos/${todo.body.id}/completion`, undefined, token)).body.done).toBe(true);

    const lists = (await api('GET', `/projects/${pid}/todolists`, undefined, token)).body;
    expect(lists[0].todos[0]).toMatchObject({ title: 'Write copy', done: true, assignee: { name: 'Bob' }, commentCount: 1 });
    expect((await api('DELETE', `/todos/${todo.body.id}/completion`, undefined, token)).body.done).toBe(false);
    expect((await api('GET', `/todos/${todo.body.id}`, undefined, token)).body.comments[0].body).toBe('On it');
  });

  it('covers posts, docs, events and Campfire', async () => {
    const { token } = (await api('POST', '/auth/login', { email: 'ada@example.com', password: 'password123' })).body;
    const pid = (await api('POST', '/projects', { name: 'Tools' }, token)).body.id;

    const post = (await api('POST', `/projects/${pid}/posts`, { title: 'Kickoff', body: '**Hi**' }, token)).body;
    await api('POST', `/posts/${post.id}/comments`, { body: 'Welcome' }, token);
    expect((await api('GET', `/posts/${post.id}`, undefined, token)).body.comments).toHaveLength(1);
    expect((await api('GET', `/projects/${pid}/posts`, undefined, token)).body[0].commentCount).toBe(1);

    const doc = (await api('POST', `/projects/${pid}/docs`, { title: 'Spec', body: 'v1' }, token)).body;
    await api('PATCH', `/docs/${doc.id}`, { body: 'v2' }, token);
    expect((await api('GET', `/docs/${doc.id}`, undefined, token)).body.body).toBe('v2');

    const ev = await api('POST', `/projects/${pid}/events`, { title: 'Demo', startsAt: '2026-11-03T15:00:00Z', endsAt: '2026-11-03T16:00:00Z' }, token);
    expect(ev.status).toBe(201);
    const bad = await api('POST', `/projects/${pid}/events`, { title: 'Bad', startsAt: '2026-11-03T15:00:00Z', endsAt: '2026-11-03T14:00:00Z' }, token);
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.endsAt).toBeDefined();
    const events = (await api('GET', `/projects/${pid}/events?from=2026-11-01T00:00:00Z`, undefined, token)).body;
    expect(events.map((e: { title: string }) => e.title)).toEqual(['Demo']);

    await api('POST', `/projects/${pid}/chat`, { body: 'hello' }, token);
    const chat = (await api('GET', `/projects/${pid}/chat`, undefined, token)).body;
    expect(chat.messages[0]).toMatchObject({ body: 'hello', author: { name: 'Ada' } });
    const poll = (await api('GET', `/projects/${pid}/chat?since=${encodeURIComponent(chat.cursor)}`, undefined, token)).body;
    expect(poll.messages).toHaveLength(1);
  });

  it('maps domain errors to HTTP statuses', async () => {
    const { token: bobToken } = (await api('POST', '/auth/login', { email: 'bob@example.com', password: 'password123' })).body;
    const { token } = (await api('POST', '/auth/login', { email: 'ada@example.com', password: 'password123' })).body;
    const pid = (await api('POST', '/projects', { name: 'Private' }, token)).body.id;
    expect((await api('GET', `/projects/${pid}`, undefined, bobToken)).status).toBe(403);
    expect((await api('GET', '/projects/nope', undefined, token)).status).toBe(404);
    expect((await api('POST', '/projects', '{oops', token)).status).toBe(400);
    expect((await api('POST', '/auth/register', { email: 'ada@example.com', name: 'Dup', password: 'password123' })).status).toBe(409);
    expect((await api('POST', '/auth/login', { email: 'ada@example.com', password: 'wrong-password' })).status).toBe(401);
    expect((await api('GET', '/nope', undefined, token)).status).toBe(404);
  });

  it('issues, lists and revokes personal access tokens, scoped to their owner', async () => {
    const { token } = (await api('POST', '/auth/login', { email: 'ada@example.com', password: 'password123' })).body;
    const { token: bobToken } = (await api('POST', '/auth/login', { email: 'bob@example.com', password: 'password123' })).body;

    const created = await api('POST', '/access-tokens', { name: 'My laptop' }, token);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'My laptop', expiresAt: null });
    const pat = created.body.token;

    // The PAT itself authenticates to the REST API, same as a session token would.
    expect((await api('GET', '/auth/me', undefined, pat)).body).toMatchObject({ email: 'ada@example.com' });

    const list = await api('GET', '/access-tokens', undefined, token);
    expect(list.body).toEqual([{ id: created.body.id, name: 'My laptop', createdAt: created.body.createdAt, expiresAt: null, revoked: false }]);
    expect((await api('GET', '/access-tokens', undefined, bobToken)).body).toEqual([]);

    expect((await api('DELETE', `/access-tokens/${created.body.id}`, undefined, bobToken)).status).toBe(403);
    expect((await api('DELETE', `/access-tokens/${created.body.id}`, undefined, token)).status).toBe(200);
    expect((await api('GET', '/auth/me', undefined, pat)).status).toBe(401);
  });
});

describe('MCP adapter', () => {
  it('rejects requests without a valid session token', async () => {
    const res = await call('mcp.localhost', 'POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.status).toBe(401);
  });

  it('serves the same domain as the REST API to a real MCP client', async () => {
    const { token } = (await api('POST', '/auth/login', { email: 'ada@example.com', password: 'password123' })).body;
    // Mount the MCP app on its own port: fetch() can't override Host, so we skip vhost routing here
    // (vhost dispatch is covered above).
    const mcpServer = createMcpApp(camp).listen(0);
    await new Promise<void>((r) => mcpServer.once('listening', () => r()));
    const mcpPort = (mcpServer.address() as AddressInfo).port;

    const client = new Client({ name: 'camp-test', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${mcpPort}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    try {
      const names = (await client.listTools()).tools.map((t) => t.name);
      expect(names).toEqual(expect.arrayContaining(['list_projects', 'create_todo', 'post_message', 'read_campfire']));

      const text = (r: unknown) => JSON.parse((r as { content: { text: string }[] }).content[0]!.text);
      const project = text(await client.callTool({ name: 'create_project', arguments: { name: 'From MCP' } }));
      const list = text(await client.callTool({ name: 'create_todo_list', arguments: { projectId: project.id, name: 'Agent tasks' } }));
      text(await client.callTool({ name: 'create_todo', arguments: { listId: list.id, title: 'Made by an agent' } }));
      text(await client.callTool({ name: 'post_message', arguments: { projectId: project.id, title: 'Hello', body: 'from MCP' } }));

      // ...and the REST API sees exactly what MCP wrote.
      const lists = (await api('GET', `/projects/${project.id}/todolists`, undefined, token)).body;
      expect(lists[0].todos[0].title).toBe('Made by an agent');
      expect((await api('GET', `/projects/${project.id}/posts`, undefined, token)).body[0].title).toBe('Hello');

      const err = await client.callTool({ name: 'get_project', arguments: { projectId: 'nope' } });
      expect(err.isError).toBe(true);
    } finally {
      await client.close();
      mcpServer.close();
    }
  });

  it('authenticates with a long-lived personal access token instead of a Session', async () => {
    const { token } = (await api('POST', '/auth/login', { email: 'ada@example.com', password: 'password123' })).body;
    const pat = (await api('POST', '/access-tokens', { name: 'MCP client' }, token)).body.token;

    const mcpServer = createMcpApp(camp).listen(0);
    await new Promise<void>((r) => mcpServer.once('listening', () => r()));
    const mcpPort = (mcpServer.address() as AddressInfo).port;

    const client = new Client({ name: 'camp-test-pat', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${mcpPort}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${pat}` } },
      }),
    );
    try {
      const result = await client.callTool({ name: 'whoami', arguments: {} });
      const whoami = JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
      expect(whoami.email).toBe('ada@example.com');
    } finally {
      await client.close();
      mcpServer.close();
    }
  });
});
