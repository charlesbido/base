import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { requireMember, userDirectory } from '../shared.js';
import type { Id } from '../types.js';
import type { TodoListView } from '../views.js';
import { todoView } from './mappers.js';

export interface ListTodoListsInput {
  actorId: Id;
  projectId: Id;
}

export type ListTodoListsDeps = Pick<CampDeps, 'projects' | 'todos' | 'comments' | 'users'>;

/**
 * The project's To-dos screen: every list with its items. Open items come first (in creation
 * order), then completed items (most recently completed first).
 */
export function listTodoLists(deps: ListTodoListsDeps, input: ListTodoListsInput): Result<TodoListView[]> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;

  const lists = deps.todos.listListsByProject(input.projectId);
  const todos = deps.todos.listTodosByProject(input.projectId);
  const counts = deps.comments.countForParents('todo', todos.map((t) => t.id));
  const user = userDirectory(deps.users, todos.flatMap((t) => [t.assigneeId, t.createdBy]));

  return ok(
    lists.map((list) => {
      const items = todos.filter((t) => t.listId === list.id);
      const open = items.filter((t) => !t.done);
      const done = items
        .filter((t) => t.done)
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
      return {
        id: list.id,
        projectId: list.projectId,
        name: list.name,
        description: list.description,
        createdAt: list.createdAt,
        todos: [...open, ...done].map((t) => todoView(t, user, counts.get(t.id) ?? 0)),
        totalCount: items.length,
        completedCount: done.length,
      };
    }),
  );
}
