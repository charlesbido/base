/**
 * CLI command table. Each entry is a thin translation onto exactly one Camp command or query —
 * the same handlers the REST API and MCP adapter use. This mirrors adapters/mcp/tools.ts in
 * shape, but covers the full command/query surface (including deletes and updates the MCP tool
 * set omits for safety in an agent context), since a human operating a terminal is trusted with
 * the complete CRUD surface the REST API exposes.
 */
import type { Camp, Result, UserSummary } from '../../domain/index.js';
import { type ArgSpec, opt, optNullable, optNullableNum, optNum, req } from './flags.js';

// `input` is deliberately loosely typed, like apiApp.ts's `input` helper: every domain handler
// re-validates its own input at runtime, and a flag-parsed object can't statically prove it has
// the required fields a specific command's input type demands.
export type CliRun = (camp: Camp, actor: UserSummary, input: any) => Result<unknown> | Promise<Result<unknown>>;

export interface CliCommand {
  name: string;
  description: string;
  kind: 'read' | 'write' | 'delete';
  args: ArgSpec[];
  run: CliRun;
}

function cmd(name: string, description: string, args: ArgSpec[], run: CliRun, kind: CliCommand['kind'] = 'write'): CliCommand {
  return { name, description, kind, args, run };
}

const a = (actor: UserSummary) => actor.id;

export const registry: CliCommand[] = [
  // ---- People & projects ------------------------------------------------------------------
  cmd('whoami', 'Show the Camp user this token acts as.', [], (_camp, actor) => ({ ok: true, value: actor }), 'read'),
  cmd('list-people', 'List every user account on this Camp instance.', [], (camp, actor) => camp.queries.listUsers({ actorId: a(actor) }), 'read'),
  cmd('list-projects', 'List the projects you are a member of.', [], (camp, actor) => camp.queries.listProjects({ actorId: a(actor) }), 'read'),
  cmd('get-project', 'Get a project with its members and at-a-glance stats.', [req('projectId', 'project id')],
    (camp, actor, i) => camp.queries.getProject({ actorId: a(actor), ...i }), 'read'),
  cmd('create-project', 'Create a new project (you become its first member).',
    [req('name', 'project name'), opt('description', 'project description')],
    (camp, actor, i) => camp.commands.createProject({ actorId: a(actor), ...i })),
  cmd('update-project', 'Rename a project or change its description.',
    [req('projectId', 'project id'), opt('name', 'new name'), opt('description', 'new description')],
    (camp, actor, i) => camp.commands.updateProject({ actorId: a(actor), ...i })),
  cmd('delete-project', 'Delete a project and everything in it. Creator only.', [req('projectId', 'project id')],
    (camp, actor, i) => camp.commands.deleteProject({ actorId: a(actor), ...i }), 'delete'),
  cmd('add-project-member', 'Add an existing user to a project, by email or user id.',
    [req('projectId', 'project id'), opt('email', 'user email'), opt('userId', 'user id')],
    (camp, actor, i) => camp.commands.addProjectMember({ actorId: a(actor), ...i })),
  cmd('remove-project-member', 'Remove a user from a project.',
    [req('projectId', 'project id'), req('userId', 'user id')],
    (camp, actor, i) => camp.commands.removeProjectMember({ actorId: a(actor), ...i }), 'delete'),

  // ---- To-dos -----------------------------------------------------------------------------
  cmd('list-todos', "List a project's to-do lists and their to-dos.", [req('projectId', 'project id')],
    (camp, actor, i) => camp.queries.listTodoLists({ actorId: a(actor), ...i }), 'read'),
  cmd('get-todo', 'Get one to-do with its comments.', [req('todoId', 'to-do id')],
    (camp, actor, i) => camp.queries.getTodo({ actorId: a(actor), ...i }), 'read'),
  cmd('create-todo-list', 'Create a to-do list in a project.',
    [req('projectId', 'project id'), req('name', 'list name'), opt('description', 'list description')],
    (camp, actor, i) => camp.commands.createTodoList({ actorId: a(actor), ...i })),
  cmd('update-todo-list', 'Rename a to-do list or change its description.',
    [req('listId', 'to-do list id'), opt('name', 'new name'), opt('description', 'new description')],
    (camp, actor, i) => camp.commands.updateTodoList({ actorId: a(actor), ...i })),
  cmd('delete-todo-list', 'Delete a to-do list, its to-dos and their comments.', [req('listId', 'to-do list id')],
    (camp, actor, i) => camp.commands.deleteTodoList({ actorId: a(actor), ...i }), 'delete'),
  cmd('create-todo', 'Add a to-do to a list.',
    [
      req('listId', 'to-do list id'),
      req('title', 'to-do title'),
      opt('description', 'to-do description'),
      optNullable('assigneeId', 'user id of a project member, or "null"'),
      optNullable('dueDate', 'YYYY-MM-DD, or "null"'),
    ],
    (camp, actor, i) => camp.commands.createTodo({ actorId: a(actor), ...i })),
  cmd('update-todo', 'Edit a to-do. Pass --assignee-id null or --due-date null to clear.',
    [
      req('todoId', 'to-do id'),
      opt('title', 'new title'),
      opt('description', 'new description'),
      optNullable('assigneeId', 'user id of a project member, or "null"'),
      optNullable('dueDate', 'YYYY-MM-DD, or "null"'),
      opt('listId', 'move to another list in the same project'),
    ],
    (camp, actor, i) => camp.commands.updateTodo({ actorId: a(actor), ...i })),
  cmd('complete-todo', 'Mark a to-do as done.', [req('todoId', 'to-do id')],
    (camp, actor, i) => camp.commands.setTodoCompletion({ actorId: a(actor), ...i, done: true })),
  cmd('uncomplete-todo', 'Re-open a completed to-do.', [req('todoId', 'to-do id')],
    (camp, actor, i) => camp.commands.setTodoCompletion({ actorId: a(actor), ...i, done: false })),
  cmd('delete-todo', 'Delete a to-do and its comments.', [req('todoId', 'to-do id')],
    (camp, actor, i) => camp.commands.deleteTodo({ actorId: a(actor), ...i }), 'delete'),
  cmd('comment-on-todo', 'Comment on a to-do.', [req('todoId', 'to-do id'), req('body', 'comment text')],
    (camp, actor, i) => camp.commands.addComment({ actorId: a(actor), parentType: 'todo', parentId: i.todoId as string, body: i.body as string })),

  // ---- Message Board ------------------------------------------------------------------------
  cmd('list-messages', "List a project's Message Board posts (newest first).", [req('projectId', 'project id')],
    (camp, actor, i) => camp.queries.listPosts({ actorId: a(actor), ...i }), 'read'),
  cmd('get-message', 'Read a Message Board post and its comments.', [req('postId', 'post id')],
    (camp, actor, i) => camp.queries.getPost({ actorId: a(actor), ...i }), 'read'),
  cmd('post-message', 'Post a new message to a project Message Board.',
    [req('projectId', 'project id'), req('title', 'post title'), req('body', 'post body')],
    (camp, actor, i) => camp.commands.createPost({ actorId: a(actor), ...i })),
  cmd('update-message', 'Edit a Message Board post. Author only.',
    [req('postId', 'post id'), opt('title', 'new title'), opt('body', 'new body')],
    (camp, actor, i) => camp.commands.updatePost({ actorId: a(actor), ...i })),
  cmd('delete-message', 'Delete a Message Board post and its comments. Author only.', [req('postId', 'post id')],
    (camp, actor, i) => camp.commands.deletePost({ actorId: a(actor), ...i }), 'delete'),
  cmd('comment-on-message', 'Comment on a Message Board post.', [req('postId', 'post id'), req('body', 'comment text')],
    (camp, actor, i) => camp.commands.addComment({ actorId: a(actor), parentType: 'post', parentId: i.postId as string, body: i.body as string })),
  cmd('delete-comment', 'Delete a comment (on a to-do or a post). Author only.', [req('commentId', 'comment id')],
    (camp, actor, i) => camp.commands.deleteComment({ actorId: a(actor), ...i }), 'delete'),

  // ---- Docs -------------------------------------------------------------------------------
  cmd('list-docs', "List a project's docs.", [req('projectId', 'project id')],
    (camp, actor, i) => camp.queries.listDocs({ actorId: a(actor), ...i }), 'read'),
  cmd('get-doc', 'Read a doc.', [req('docId', 'doc id')],
    (camp, actor, i) => camp.queries.getDoc({ actorId: a(actor), ...i }), 'read'),
  cmd('create-doc', 'Create a doc.', [req('projectId', 'project id'), req('title', 'doc title'), opt('body', 'doc body')],
    (camp, actor, i) => camp.commands.createDoc({ actorId: a(actor), ...i })),
  cmd('update-doc', 'Edit a doc (replaces title and/or body).',
    [req('docId', 'doc id'), opt('title', 'new title'), opt('body', 'new body')],
    (camp, actor, i) => camp.commands.updateDoc({ actorId: a(actor), ...i })),
  cmd('delete-doc', 'Delete a doc.', [req('docId', 'doc id')],
    (camp, actor, i) => camp.commands.deleteDoc({ actorId: a(actor), ...i }), 'delete'),

  // ---- Schedule ---------------------------------------------------------------------------
  cmd('list-events', "List a project's schedule, optionally within a time window.",
    [req('projectId', 'project id'), opt('from', 'window start, ISO-8601'), opt('to', 'window end, ISO-8601')],
    (camp, actor, i) => camp.queries.listEvents({ actorId: a(actor), ...i }), 'read'),
  cmd('get-event', 'Get one schedule event.', [req('eventId', 'event id')],
    (camp, actor, i) => camp.queries.getEvent({ actorId: a(actor), ...i }), 'read'),
  cmd('create-event', 'Add an event to a project schedule.',
    [
      req('projectId', 'project id'),
      req('title', 'event title'),
      req('startsAt', 'start, ISO-8601 date-time'),
      req('endsAt', 'end, ISO-8601 date-time'),
      opt('description', 'event description'),
    ],
    (camp, actor, i) => camp.commands.createEvent({ actorId: a(actor), ...i })),
  cmd('update-event', 'Edit a schedule event.',
    [
      req('eventId', 'event id'),
      opt('title', 'new title'),
      opt('startsAt', 'new start, ISO-8601 date-time'),
      opt('endsAt', 'new end, ISO-8601 date-time'),
      opt('description', 'new description'),
    ],
    (camp, actor, i) => camp.commands.updateEvent({ actorId: a(actor), ...i })),
  cmd('delete-event', 'Delete a schedule event.', [req('eventId', 'event id')],
    (camp, actor, i) => camp.commands.deleteEvent({ actorId: a(actor), ...i }), 'delete'),

  // ---- Access tokens ------------------------------------------------------------------------
  cmd('list-access-tokens', 'List your own long-lived personal access tokens (never shows the raw token).', [],
    (camp, actor) => camp.queries.listAccessTokens({ actorId: a(actor) }), 'read'),
  cmd('create-access-token', 'Mint a new long-lived personal access token. The raw token is only ever returned here.',
    [req('name', 'label to recognise this token later'), optNullableNum('expiresInDays', 'days until expiry, or "null"/omit for no expiry')],
    (camp, actor, i) => camp.commands.createAccessToken({ actorId: a(actor), ...i })),
  cmd('revoke-access-token', 'Revoke one of your personal access tokens immediately.', [req('tokenId', 'access token id')],
    (camp, actor, i) => camp.commands.revokeAccessToken({ actorId: a(actor), ...i }), 'delete'),

  // ---- Campfire ---------------------------------------------------------------------------
  cmd('read-campfire', "Read a project's Campfire chat (latest messages, or those since a cursor).",
    [req('projectId', 'project id'), opt('since', 'cursor from a previous call'), optNum('limit', 'max messages')],
    (camp, actor, i) => camp.queries.listChatMessages({ actorId: a(actor), ...i }), 'read'),
  cmd('send-campfire-message', "Say something in a project's Campfire chat.",
    [req('projectId', 'project id'), req('body', 'message text')],
    (camp, actor, i) => camp.commands.postChatMessage({ actorId: a(actor), ...i })),
];
