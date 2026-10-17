import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { requireMember } from '../shared.js';
import type { Id } from '../types.js';

export interface DeleteTodoInput {
  actorId: Id;
  todoId: Id;
}

export type DeleteTodoDeps = Pick<CampDeps, 'projects' | 'todos'>;

export function deleteTodo(deps: DeleteTodoDeps, input: DeleteTodoInput): Result<{ id: Id }> {
  const todo = deps.todos.findTodoById(input.todoId);
  if (!todo) return notFound('To-do');
  const access = requireMember(deps.projects, todo.projectId, input.actorId);
  if (!access.ok) return access;
  deps.todos.deleteTodo(todo.id);
  return ok({ id: todo.id });
}
