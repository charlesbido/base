/**
 * REST API adapter. Each route: parse request -> call exactly one command or query -> shape response.
 * No business rules live here.
 */
import cookieParser from 'cookie-parser';
import express, { type Request, type Response } from 'express';
import type { Camp, CommentParentType, Result } from '../../domain/index.js';
import { cors } from './cors.js';
import { errorHandler, send } from './respond.js';
import { actorOf, requireUser, SESSION_COOKIE, tokenFrom } from './session.js';

export interface ApiOptions {
  /** Browser origins allowed to call this API cross-origin with credentials. */
  corsOrigins?: string[];
  /** Mark the session cookie Secure (enable behind HTTPS). */
  secureCookies?: boolean;
}

type Handler = (req: Request, res: Response) => Result<unknown> | Promise<Result<unknown>>;

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const param = (req: Request, name: string): string => String(req.params[name] ?? '');

export function createApiApp(camp: Camp, options: ApiOptions = {}): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);
  app.use(cors(options.corsOrigins));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: options.secureCookies ?? false,
    path: '/',
  };

  /** Wraps a handler: runs it and writes the Result. */
  const handle =
    (fn: Handler, successStatus = 200) =>
    async (req: Request, res: Response) => {
      send(res, await fn(req, res), successStatus);
    };
  const authed = requireUser(camp);
  const body = (req: Request): Record<string, unknown> =>
    req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  /**
   * Untrusted body merged with server-controlled fields (actor, path ids), which always win.
   * Deliberately loosely typed: every domain handler re-validates its input at runtime.
   */
  const input = (req: Request, fixed: Record<string, unknown>): any => ({ ...body(req), ...fixed });
  const { commands: c, queries: q } = camp;

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ---- Auth & people ----------------------------------------------------------------------

  /** Registers and immediately signs in. */
  app.post('/auth/register', async (req, res) => {
    const b = body(req);
    const registered = await c.registerUser({ email: b.email as string, name: b.name as string, password: b.password as string });
    if (!registered.ok) return send(res, registered);
    const session = await c.login({ email: b.email as string, password: b.password as string });
    if (session.ok) res.cookie(SESSION_COOKIE, session.value.token, { ...cookieOptions, expires: new Date(session.value.expiresAt) });
    send(res, session, 201);
  });

  app.post('/auth/login', async (req, res) => {
    const b = body(req);
    const session = await c.login({ email: b.email as string, password: b.password as string });
    if (session.ok) res.cookie(SESSION_COOKIE, session.value.token, { ...cookieOptions, expires: new Date(session.value.expiresAt) });
    send(res, session);
  });

  app.post('/auth/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    send(res, c.logout({ token: tokenFrom(req) }));
  });

  app.get('/auth/me', authed, (_req, res) => {
    res.json(actorOf(res));
  });

  app.get('/users', authed, handle((_req, res) => q.listUsers({ actorId: actorOf(res).id })));

  // ---- Projects & membership --------------------------------------------------------------

  app.get('/projects', authed, handle((_req, res) => q.listProjects({ actorId: actorOf(res).id })));
  app.post('/projects', authed, handle((req, res) => c.createProject(input(req, { actorId: actorOf(res).id })), 201));
  app.get('/projects/:id', authed, handle((req, res) => q.getProject({ actorId: actorOf(res).id, projectId: param(req, 'id') })));
  app.patch('/projects/:id', authed, handle((req, res) =>
    c.updateProject(input(req, { actorId: actorOf(res).id, projectId: param(req, 'id') })),
  ));
  app.delete('/projects/:id', authed, handle((req, res) => c.deleteProject({ actorId: actorOf(res).id, projectId: param(req, 'id') })));
  app.post('/projects/:id/members', authed, handle((req, res) =>
    c.addProjectMember(input(req, { actorId: actorOf(res).id, projectId: param(req, 'id') })), 201,
  ));
  app.delete('/projects/:id/members/:userId', authed, handle((req, res) =>
    c.removeProjectMember({ actorId: actorOf(res).id, projectId: param(req, 'id'), userId: param(req, 'userId') }),
  ));

  // ---- To-dos -----------------------------------------------------------------------------

  app.get('/projects/:id/todolists', authed, handle((req, res) =>
    q.listTodoLists({ actorId: actorOf(res).id, projectId: param(req, 'id') }),
  ));
  app.post('/projects/:id/todolists', authed, handle((req, res) =>
    c.createTodoList(input(req, { actorId: actorOf(res).id, projectId: param(req, 'id') })), 201,
  ));
  app.patch('/todolists/:id', authed, handle((req, res) =>
    c.updateTodoList(input(req, { actorId: actorOf(res).id, listId: param(req, 'id') })),
  ));
  app.delete('/todolists/:id', authed, handle((req, res) => c.deleteTodoList({ actorId: actorOf(res).id, listId: param(req, 'id') })));
  app.post('/todolists/:id/todos', authed, handle((req, res) =>
    c.createTodo(input(req, { actorId: actorOf(res).id, listId: param(req, 'id') })), 201,
  ));
  app.get('/todos/:id', authed, handle((req, res) => q.getTodo({ actorId: actorOf(res).id, todoId: param(req, 'id') })));
  app.patch('/todos/:id', authed, handle((req, res) =>
    c.updateTodo(input(req, { actorId: actorOf(res).id, todoId: param(req, 'id') })),
  ));
  app.delete('/todos/:id', authed, handle((req, res) => c.deleteTodo({ actorId: actorOf(res).id, todoId: param(req, 'id') })));
  // Completion is its own resource (Basecamp-style): POST completes, DELETE reopens.
  app.post('/todos/:id/completion', authed, handle((req, res) =>
    c.setTodoCompletion({ actorId: actorOf(res).id, todoId: param(req, 'id'), done: true }),
  ));
  app.delete('/todos/:id/completion', authed, handle((req, res) =>
    c.setTodoCompletion({ actorId: actorOf(res).id, todoId: param(req, 'id'), done: false }),
  ));

  // ---- Comments (on to-dos and posts) -----------------------------------------------------

  const commentRoute = (parentType: CommentParentType) =>
    handle((req, res) =>
      c.addComment({ actorId: actorOf(res).id, parentType, parentId: param(req, 'id'), body: body(req).body as string }),
    201);
  app.post('/todos/:id/comments', authed, commentRoute('todo'));
  app.post('/posts/:id/comments', authed, commentRoute('post'));
  app.delete('/comments/:id', authed, handle((req, res) => c.deleteComment({ actorId: actorOf(res).id, commentId: param(req, 'id') })));

  // ---- Message Board ----------------------------------------------------------------------

  app.get('/projects/:id/posts', authed, handle((req, res) => q.listPosts({ actorId: actorOf(res).id, projectId: param(req, 'id') })));
  app.post('/projects/:id/posts', authed, handle((req, res) =>
    c.createPost(input(req, { actorId: actorOf(res).id, projectId: param(req, 'id') })), 201,
  ));
  app.get('/posts/:id', authed, handle((req, res) => q.getPost({ actorId: actorOf(res).id, postId: param(req, 'id') })));
  app.patch('/posts/:id', authed, handle((req, res) => c.updatePost(input(req, { actorId: actorOf(res).id, postId: param(req, 'id') }))));
  app.delete('/posts/:id', authed, handle((req, res) => c.deletePost({ actorId: actorOf(res).id, postId: param(req, 'id') })));

  // ---- Docs -------------------------------------------------------------------------------

  app.get('/projects/:id/docs', authed, handle((req, res) => q.listDocs({ actorId: actorOf(res).id, projectId: param(req, 'id') })));
  app.post('/projects/:id/docs', authed, handle((req, res) =>
    c.createDoc(input(req, { actorId: actorOf(res).id, projectId: param(req, 'id') })), 201,
  ));
  app.get('/docs/:id', authed, handle((req, res) => q.getDoc({ actorId: actorOf(res).id, docId: param(req, 'id') })));
  app.patch('/docs/:id', authed, handle((req, res) => c.updateDoc(input(req, { actorId: actorOf(res).id, docId: param(req, 'id') }))));
  app.delete('/docs/:id', authed, handle((req, res) => c.deleteDoc({ actorId: actorOf(res).id, docId: param(req, 'id') })));

  // ---- Schedule ---------------------------------------------------------------------------

  app.get('/projects/:id/events', authed, handle((req, res) => {
    const input = { actorId: actorOf(res).id, projectId: param(req, 'id') };
    const from = str(req.query.from);
    const to = str(req.query.to);
    return q.listEvents({ ...input, ...(from ? { from } : {}), ...(to ? { to } : {}) });
  }));
  app.post('/projects/:id/events', authed, handle((req, res) =>
    c.createEvent(input(req, { actorId: actorOf(res).id, projectId: param(req, 'id') })), 201,
  ));
  app.get('/events/:id', authed, handle((req, res) => q.getEvent({ actorId: actorOf(res).id, eventId: param(req, 'id') })));
  app.patch('/events/:id', authed, handle((req, res) => c.updateEvent(input(req, { actorId: actorOf(res).id, eventId: param(req, 'id') }))));
  app.delete('/events/:id', authed, handle((req, res) => c.deleteEvent({ actorId: actorOf(res).id, eventId: param(req, 'id') })));

  // ---- Campfire ---------------------------------------------------------------------------

  app.get('/projects/:id/chat', authed, handle((req, res) => {
    const since = str(req.query.since);
    const limit = str(req.query.limit);
    return q.listChatMessages({
      actorId: actorOf(res).id,
      projectId: param(req, 'id'),
      ...(since ? { since } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });
  }));
  app.post('/projects/:id/chat', authed, handle((req, res) =>
    c.postChatMessage({ actorId: actorOf(res).id, projectId: param(req, 'id'), body: body(req).body as string }), 201,
  ));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'No such endpoint' } });
  });
  app.use(errorHandler);
  return app;
}
