import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { requireMember, userDirectory } from '../shared.js';
import type { Id } from '../types.js';
import type { TodoDetail } from '../views.js';
import { commentViews, todoView } from './mappers.js';

export interface GetTodoInput {
  actorId: Id;
  todoId: Id;
}

export type GetTodoDeps = Pick<CampDeps, 'projects' | 'todos' | 'comments' | 'users'>;

/** A single to-do with its list and comment thread. */
export function getTodo(deps: GetTodoDeps, input: GetTodoInput): Result<TodoDetail> {
  const todo = deps.todos.findTodoById(input.todoId);
  if (!todo) return notFound('To-do');
  const access = requireMember(deps.projects, todo.projectId, input.actorId);
  if (!access.ok) return access;

  const list = deps.todos.findListById(todo.listId);
  const comments = commentViews(deps, 'todo', todo.id);
  const user = userDirectory(deps.users, [todo.assigneeId, todo.createdBy]);
  return ok({
    ...todoView(todo, user, comments.length),
    list: { id: todo.listId, name: list?.name ?? '' },
    comments,
  });
}
