/**
 * CLI command table: each entry maps a subcommand onto exactly one REST API call — the same
 * routes curl or the web app uses (see adapters/http/apiApp.ts, which this mirrors route for
 * route). The CLI never runs domain code in-process; it's a thin HTTP client, so there is no
 * `Camp`/domain import here, only the wire-level RestClient.
 */
import type { CliResult, RestClient } from './httpClient.js';
import { type ArgSpec, opt, optNullable, optNullableNum, optNum, req } from './flags.js';

// `input` is deliberately loosely typed: it's the flag-parsed object built from each command's
// own `args` spec below, and every field access here is already known-safe by construction.
export type CliRun = (client: RestClient, input: any) => Promise<CliResult<unknown>>;

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

const enc = (id: string) => encodeURIComponent(id);

export const registry: CliCommand[] = [
  // ---- People & projects ------------------------------------------------------------------
  cmd('whoami', 'Show the Camp user this token acts as.', [], (client) => client.request('GET', '/auth/me'), 'read'),
  cmd('list-people', 'List every user account on this Camp instance.', [],
    (client) => client.request('GET', '/users'), 'read'),
  cmd('list-projects', 'List the projects you are a member of.', [],
    (client) => client.request('GET', '/projects'), 'read'),
  cmd('get-project', 'Get a project with its members and at-a-glance stats.', [req('projectId', 'project id')],
    (client, i) => client.request('GET', `/projects/${enc(i.projectId)}`), 'read'),
  cmd('create-project', 'Create a new project (you become its first member).',
    [req('name', 'project name'), opt('description', 'project description')],
    (client, i) => client.request('POST', '/projects', { body: { name: i.name, description: i.description } })),
  cmd('update-project', 'Rename a project or change its description.',
    [req('projectId', 'project id'), opt('name', 'new name'), opt('description', 'new description')],
    (client, i) => client.request('PATCH', `/projects/${enc(i.projectId)}`, { body: { name: i.name, description: i.description } })),
  cmd('delete-project', 'Delete a project and everything in it. Creator only.', [req('projectId', 'project id')],
    (client, i) => client.request('DELETE', `/projects/${enc(i.projectId)}`), 'delete'),
  cmd('add-project-member', 'Add an existing user to a project, by email or user id.',
    [req('projectId', 'project id'), opt('email', 'user email'), opt('userId', 'user id')],
    (client, i) => client.request('POST', `/projects/${enc(i.projectId)}/members`, { body: { email: i.email, userId: i.userId } })),
  cmd('remove-project-member', 'Remove a user from a project.',
    [req('projectId', 'project id'), req('userId', 'user id')],
    (client, i) => client.request('DELETE', `/projects/${enc(i.projectId)}/members/${enc(i.userId)}`), 'delete'),

  // ---- To-dos -----------------------------------------------------------------------------
  cmd('list-todos', "List a project's to-do lists and their to-dos.", [req('projectId', 'project id')],
    (client, i) => client.request('GET', `/projects/${enc(i.projectId)}/todolists`), 'read'),
  cmd('get-todo', 'Get one to-do with its comments.', [req('todoId', 'to-do id')],
    (client, i) => client.request('GET', `/todos/${enc(i.todoId)}`), 'read'),
  cmd('create-todo-list', 'Create a to-do list in a project.',
    [req('projectId', 'project id'), req('name', 'list name'), opt('description', 'list description')],
    (client, i) => client.request('POST', `/projects/${enc(i.projectId)}/todolists`, { body: { name: i.name, description: i.description } })),
  cmd('update-todo-list', 'Rename a to-do list or change its description.',
    [req('listId', 'to-do list id'), opt('name', 'new name'), opt('description', 'new description')],
    (client, i) => client.request('PATCH', `/todolists/${enc(i.listId)}`, { body: { name: i.name, description: i.description } })),
  cmd('delete-todo-list', 'Delete a to-do list, its to-dos and their comments.', [req('listId', 'to-do list id')],
    (client, i) => client.request('DELETE', `/todolists/${enc(i.listId)}`), 'delete'),
  cmd('create-todo', 'Add a to-do to a list.',
    [
      req('listId', 'to-do list id'),
      req('title', 'to-do title'),
      opt('description', 'to-do description'),
      optNullable('assigneeId', 'user id of a project member, or "null"'),
      optNullable('dueDate', 'YYYY-MM-DD, or "null"'),
    ],
    (client, i) => client.request('POST', `/todolists/${enc(i.listId)}/todos`,
      { body: { title: i.title, description: i.description, assigneeId: i.assigneeId, dueDate: i.dueDate } })),
  cmd('update-todo', 'Edit a to-do. Pass --assignee-id null or --due-date null to clear.',
    [
      req('todoId', 'to-do id'),
      opt('title', 'new title'),
      opt('description', 'new description'),
      optNullable('assigneeId', 'user id of a project member, or "null"'),
      optNullable('dueDate', 'YYYY-MM-DD, or "null"'),
      opt('listId', 'move to another list in the same project'),
    ],
    (client, i) => client.request('PATCH', `/todos/${enc(i.todoId)}`,
      { body: { title: i.title, description: i.description, assigneeId: i.assigneeId, dueDate: i.dueDate, listId: i.listId } })),
  cmd('complete-todo', 'Mark a to-do as done.', [req('todoId', 'to-do id')],
    (client, i) => client.request('POST', `/todos/${enc(i.todoId)}/completion`)),
  cmd('uncomplete-todo', 'Re-open a completed to-do.', [req('todoId', 'to-do id')],
    (client, i) => client.request('DELETE', `/todos/${enc(i.todoId)}/completion`)),
  cmd('delete-todo', 'Delete a to-do and its comments.', [req('todoId', 'to-do id')],
    (client, i) => client.request('DELETE', `/todos/${enc(i.todoId)}`), 'delete'),
  cmd('comment-on-todo', 'Comment on a to-do.', [req('todoId', 'to-do id'), req('body', 'comment text')],
    (client, i) => client.request('POST', `/todos/${enc(i.todoId)}/comments`, { body: { body: i.body } })),

  // ---- Message Board ------------------------------------------------------------------------
  cmd('list-messages', "List a project's Message Board posts (newest first).", [req('projectId', 'project id')],
    (client, i) => client.request('GET', `/projects/${enc(i.projectId)}/posts`), 'read'),
  cmd('get-message', 'Read a Message Board post and its comments.', [req('postId', 'post id')],
    (client, i) => client.request('GET', `/posts/${enc(i.postId)}`), 'read'),
  cmd('post-message', 'Post a new message to a project Message Board.',
    [req('projectId', 'project id'), req('title', 'post title'), req('body', 'post body')],
    (client, i) => client.request('POST', `/projects/${enc(i.projectId)}/posts`, { body: { title: i.title, body: i.body } })),
  cmd('update-message', 'Edit a Message Board post. Author only.',
    [req('postId', 'post id'), opt('title', 'new title'), opt('body', 'new body')],
    (client, i) => client.request('PATCH', `/posts/${enc(i.postId)}`, { body: { title: i.title, body: i.body } })),
  cmd('delete-message', 'Delete a Message Board post and its comments. Author only.', [req('postId', 'post id')],
    (client, i) => client.request('DELETE', `/posts/${enc(i.postId)}`), 'delete'),
  cmd('comment-on-message', 'Comment on a Message Board post.', [req('postId', 'post id'), req('body', 'comment text')],
    (client, i) => client.request('POST', `/posts/${enc(i.postId)}/comments`, { body: { body: i.body } })),
  cmd('delete-comment', 'Delete a comment (on a to-do or a post). Author only.', [req('commentId', 'comment id')],
    (client, i) => client.request('DELETE', `/comments/${enc(i.commentId)}`), 'delete'),

  // ---- Docs -------------------------------------------------------------------------------
  cmd('list-docs', "List a project's docs.", [req('projectId', 'project id')],
    (client, i) => client.request('GET', `/projects/${enc(i.projectId)}/docs`), 'read'),
  cmd('get-doc', 'Read a doc.', [req('docId', 'doc id')],
    (client, i) => client.request('GET', `/docs/${enc(i.docId)}`), 'read'),
  cmd('create-doc', 'Create a doc.', [req('projectId', 'project id'), req('title', 'doc title'), opt('body', 'doc body')],
    (client, i) => client.request('POST', `/projects/${enc(i.projectId)}/docs`, { body: { title: i.title, body: i.body } })),
  cmd('update-doc', 'Edit a doc (replaces title and/or body).',
    [req('docId', 'doc id'), opt('title', 'new title'), opt('body', 'new body')],
    (client, i) => client.request('PATCH', `/docs/${enc(i.docId)}`, { body: { title: i.title, body: i.body } })),
  cmd('delete-doc', 'Delete a doc.', [req('docId', 'doc id')],
    (client, i) => client.request('DELETE', `/docs/${enc(i.docId)}`), 'delete'),

  // ---- Schedule ---------------------------------------------------------------------------
  cmd('list-events', "List a project's schedule, optionally within a time window.",
    [req('projectId', 'project id'), opt('from', 'window start, ISO-8601'), opt('to', 'window end, ISO-8601')],
    (client, i) => client.request('GET', `/projects/${enc(i.projectId)}/events`, { query: { from: i.from, to: i.to } }), 'read'),
  cmd('get-event', 'Get one schedule event.', [req('eventId', 'event id')],
    (client, i) => client.request('GET', `/events/${enc(i.eventId)}`), 'read'),
  cmd('create-event', 'Add an event to a project schedule.',
    [
      req('projectId', 'project id'),
      req('title', 'event title'),
      req('startsAt', 'start, ISO-8601 date-time'),
      req('endsAt', 'end, ISO-8601 date-time'),
      opt('description', 'event description'),
    ],
    (client, i) => client.request('POST', `/projects/${enc(i.projectId)}/events`,
      { body: { title: i.title, startsAt: i.startsAt, endsAt: i.endsAt, description: i.description } })),
  cmd('update-event', 'Edit a schedule event.',
    [
      req('eventId', 'event id'),
      opt('title', 'new title'),
      opt('startsAt', 'new start, ISO-8601 date-time'),
      opt('endsAt', 'new end, ISO-8601 date-time'),
      opt('description', 'new description'),
    ],
    (client, i) => client.request('PATCH', `/events/${enc(i.eventId)}`,
      { body: { title: i.title, startsAt: i.startsAt, endsAt: i.endsAt, description: i.description } })),
  cmd('delete-event', 'Delete a schedule event.', [req('eventId', 'event id')],
    (client, i) => client.request('DELETE', `/events/${enc(i.eventId)}`), 'delete'),

  // ---- Access tokens ------------------------------------------------------------------------
  cmd('list-access-tokens', 'List your own long-lived personal access tokens (never shows the raw token).', [],
    (client) => client.request('GET', '/access-tokens'), 'read'),
  cmd('create-access-token', 'Mint a new long-lived personal access token. The raw token is only ever returned here.',
    [req('name', 'label to recognise this token later'), optNullableNum('expiresInDays', 'days until expiry, or "null"/omit for no expiry')],
    (client, i) => client.request('POST', '/access-tokens', { body: { name: i.name, expiresInDays: i.expiresInDays } })),
  cmd('revoke-access-token', 'Revoke one of your personal access tokens immediately.', [req('tokenId', 'access token id')],
    (client, i) => client.request('DELETE', `/access-tokens/${enc(i.tokenId)}`), 'delete'),

  // ---- Campfire ---------------------------------------------------------------------------
  cmd('read-campfire', "Read a project's Campfire chat (latest messages, or those since a cursor).",
    [req('projectId', 'project id'), opt('since', 'cursor from a previous call'), optNum('limit', 'max messages')],
    (client, i) => client.request('GET', `/projects/${enc(i.projectId)}/chat`, { query: { since: i.since, limit: i.limit } }), 'read'),
  cmd('send-campfire-message', "Say something in a project's Campfire chat.",
    [req('projectId', 'project id'), req('body', 'message text')],
    (client, i) => client.request('POST', `/projects/${enc(i.projectId)}/chat`, { body: { body: i.body } })),
];
