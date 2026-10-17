import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Id, TodoList } from '../types.js';
import { Validator } from '../validation.js';

export interface UpdateTodoListInput {
  actorId: Id;
  listId: Id;
  name?: string;
  description?: string;
}

export type UpdateTodoListDeps = Pick<CampDeps, 'projects' | 'todos' | 'clock'>;

export function updateTodoList(deps: UpdateTodoListDeps, input: UpdateTodoListInput): Result<TodoList> {
  const list = deps.todos.findListById(input.listId);
  if (!list) return notFound('To-do list');
  const access = requireMember(deps.projects, list.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const name = v.patchRequiredString(input.name, 'name', 120);
  const description = v.patchOptionalString(input.description, 'description', 2000);
  const invalid = v.failure();
  if (invalid) return invalid;

  const updated: TodoList = {
    ...list,
    name: name ?? list.name,
    description: description ?? list.description,
    updatedAt: nowIso(deps.clock),
  };
  deps.todos.updateList(updated);
  return ok(updated);
}
