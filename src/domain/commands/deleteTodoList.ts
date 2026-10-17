import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { requireMember } from '../shared.js';
import type { Id } from '../types.js';

export interface DeleteTodoListInput {
  actorId: Id;
  listId: Id;
}

export type DeleteTodoListDeps = Pick<CampDeps, 'projects' | 'todos'>;

/** Deletes the list together with its to-dos and their comments. */
export function deleteTodoList(deps: DeleteTodoListDeps, input: DeleteTodoListInput): Result<{ id: Id }> {
  const list = deps.todos.findListById(input.listId);
  if (!list) return notFound('To-do list');
  const access = requireMember(deps.projects, list.projectId, input.actorId);
  if (!access.ok) return access;
  deps.todos.deleteList(list.id);
  return ok({ id: list.id });
}
