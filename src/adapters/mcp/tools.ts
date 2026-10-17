/**
 * MCP tool definitions. Each tool is a thin translation onto exactly one Camp command or query —
 * the same handlers the REST API uses. The acting user is fixed per MCP session (see httpApp.ts /
 * ../../mcp-stdio.ts for how it is authenticated).
 */
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ShapeOutput, ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Camp, Result, UserSummary } from '../../domain/index.js';

export function toToolResult(result: Result<unknown>): CallToolResult {
  if (result.ok) {
    return { content: [{ type: 'text', text: JSON.stringify(result.value, null, 2) }] };
  }
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: result.error }, null, 2) }] };
}

const id = (what: string) => z.string().describe(`${what} id`);
const isoDateTime = (what: string) => z.string().describe(`${what} as ISO-8601 date-time, e.g. 2026-11-03T15:00:00Z`);

export function registerCampTools(server: McpServer, camp: Camp, actor: UserSummary): void {
  const { commands: c, queries: q } = camp;
  const actorId = actor.id;

  function tool<S extends ZodRawShapeCompat>(
    name: string,
    description: string,
    shape: S,
    run: (args: ShapeOutput<S>) => Result<unknown> | Promise<Result<unknown>>,
    kind: 'read' | 'write' | 'delete' = 'write',
  ): void {
    server.registerTool(
      name,
      {
        description,
        inputSchema: shape,
        annotations: {
          readOnlyHint: kind === 'read',
          destructiveHint: kind === 'delete',
          openWorldHint: false,
        },
      },
      // TS can't resolve the SDK's conditional callback type for a generic S; the shape is identical.
      (async (args: ShapeOutput<S>) => toToolResult(await run(args))) as unknown as ToolCallback<S>,
    );
  }

  // ---- People & projects ------------------------------------------------------------------
  tool('whoami', 'Show the Camp user this MCP session acts as.', {}, () => ({ ok: true, value: actor }), 'read');
  tool('list_people', 'List every user account on this Camp instance.', {}, () => q.listUsers({ actorId }), 'read');
  tool('list_projects', 'List the projects you are a member of.', {}, () => q.listProjects({ actorId }), 'read');
  tool('get_project', 'Get a project with its members and at-a-glance stats.', { projectId: id('Project') },
    (a) => q.getProject({ actorId, ...a }), 'read');
  tool('create_project', 'Create a new project (you become its first member).',
    { name: z.string(), description: z.string().optional() },
    (a) => c.createProject({ actorId, ...a }));
  tool('update_project', 'Rename a project or change its description.',
    { projectId: id('Project'), name: z.string().optional(), description: z.string().optional() },
    (a) => c.updateProject({ actorId, ...a }));
  tool('add_project_member', 'Add an existing user to a project, by email or user id.',
    { projectId: id('Project'), email: z.string().optional(), userId: z.string().optional() },
    (a) => c.addProjectMember({ actorId, ...a }));
  tool('remove_project_member', 'Remove a user from a project.',
    { projectId: id('Project'), userId: id('User') },
    (a) => c.removeProjectMember({ actorId, ...a }), 'delete');

  // ---- To-dos -----------------------------------------------------------------------------
  tool('list_todos', "List a project's to-do lists and their to-dos.", { projectId: id('Project') },
    (a) => q.listTodoLists({ actorId, ...a }), 'read');
  tool('get_todo', 'Get one to-do with its comments.', { todoId: id('To-do') },
    (a) => q.getTodo({ actorId, ...a }), 'read');
  tool('create_todo_list', 'Create a to-do list in a project.',
    { projectId: id('Project'), name: z.string(), description: z.string().optional() },
    (a) => c.createTodoList({ actorId, ...a }));
  tool('create_todo', 'Add a to-do to a list.',
    {
      listId: id('To-do list'),
      title: z.string(),
      description: z.string().optional(),
      assigneeId: z.string().nullable().optional().describe('User id of a project member'),
      dueDate: z.string().nullable().optional().describe('YYYY-MM-DD'),
    },
    (a) => c.createTodo({ actorId, ...a }));
  tool('update_todo', 'Edit a to-do. Pass null to clear assigneeId or dueDate.',
    {
      todoId: id('To-do'),
      title: z.string().optional(),
      description: z.string().optional(),
      assigneeId: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional().describe('YYYY-MM-DD'),
      listId: z.string().optional().describe('Move to another list in the same project'),
    },
    (a) => c.updateTodo({ actorId, ...a }));
  tool('complete_todo', 'Mark a to-do as done.', { todoId: id('To-do') },
    (a) => c.setTodoCompletion({ actorId, ...a, done: true }));
  tool('uncomplete_todo', 'Re-open a completed to-do.', { todoId: id('To-do') },
    (a) => c.setTodoCompletion({ actorId, ...a, done: false }));
  tool('delete_todo', 'Delete a to-do and its comments.', { todoId: id('To-do') },
    (a) => c.deleteTodo({ actorId, ...a }), 'delete');
  tool('comment_on_todo', 'Comment on a to-do.', { todoId: id('To-do'), body: z.string() },
    (a) => c.addComment({ actorId, parentType: 'todo', parentId: a.todoId, body: a.body }));

  // ---- Message Board ----------------------------------------------------------------------
  tool('list_messages', "List a project's Message Board posts (newest first).", { projectId: id('Project') },
    (a) => q.listPosts({ actorId, ...a }), 'read');
  tool('get_message', 'Read a Message Board post and its comments.', { postId: id('Post') },
    (a) => q.getPost({ actorId, ...a }), 'read');
  tool('post_message', 'Post a new message to a project Message Board. Body supports light markdown.',
    { projectId: id('Project'), title: z.string(), body: z.string() },
    (a) => c.createPost({ actorId, ...a }));
  tool('comment_on_message', 'Comment on a Message Board post.', { postId: id('Post'), body: z.string() },
    (a) => c.addComment({ actorId, parentType: 'post', parentId: a.postId, body: a.body }));

  // ---- Docs -------------------------------------------------------------------------------
  tool('list_docs', "List a project's docs.", { projectId: id('Project') },
    (a) => q.listDocs({ actorId, ...a }), 'read');
  tool('get_doc', 'Read a doc.', { docId: id('Doc') }, (a) => q.getDoc({ actorId, ...a }), 'read');
  tool('create_doc', 'Create a doc.', { projectId: id('Project'), title: z.string(), body: z.string().optional() },
    (a) => c.createDoc({ actorId, ...a }));
  tool('update_doc', 'Edit a doc (replaces title and/or body).',
    { docId: id('Doc'), title: z.string().optional(), body: z.string().optional() },
    (a) => c.updateDoc({ actorId, ...a }));

  // ---- Schedule ---------------------------------------------------------------------------
  tool('list_events', "List a project's schedule, optionally within a time window.",
    { projectId: id('Project'), from: isoDateTime('Window start').optional(), to: isoDateTime('Window end').optional() },
    (a) => q.listEvents({ actorId, ...a }), 'read');
  tool('create_event', 'Add an event to a project schedule.',
    {
      projectId: id('Project'),
      title: z.string(),
      startsAt: isoDateTime('Start'),
      endsAt: isoDateTime('End'),
      description: z.string().optional(),
    },
    (a) => c.createEvent({ actorId, ...a }));
  tool('update_event', 'Edit a schedule event.',
    {
      eventId: id('Event'),
      title: z.string().optional(),
      startsAt: isoDateTime('Start').optional(),
      endsAt: isoDateTime('End').optional(),
      description: z.string().optional(),
    },
    (a) => c.updateEvent({ actorId, ...a }));
  tool('delete_event', 'Delete a schedule event.', { eventId: id('Event') },
    (a) => c.deleteEvent({ actorId, ...a }), 'delete');

  // ---- Campfire ---------------------------------------------------------------------------
  tool('read_campfire', "Read a project's Campfire chat (latest messages, or those since a cursor).",
    { projectId: id('Project'), since: z.string().optional().describe('cursor from a previous call'), limit: z.number().int().optional() },
    (a) => q.listChatMessages({ actorId, ...a }), 'read');
  tool('send_campfire_message', "Say something in a project's Campfire chat.",
    { projectId: id('Project'), body: z.string() },
    (a) => c.postChatMessage({ actorId, ...a }));
}
