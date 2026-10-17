import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Id, TodoList } from '../types.js';
import { Validator } from '../validation.js';

export interface CreateTodoListInput {
  actorId: Id;
  projectId: Id;
  name: string;
  description?: string;
}

export type CreateTodoListDeps = Pick<CampDeps, 'projects' | 'todos' | 'ids' | 'clock'>;

export function createTodoList(deps: CreateTodoListDeps, input: CreateTodoListInput): Result<TodoList> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const name = v.requiredString(input.name, 'name', 120);
  const description = v.optionalString(input.description, 'description', 2000);
  const invalid = v.failure();
  if (invalid) return invalid;

  const now = nowIso(deps.clock);
  const list: TodoList = {
    id: deps.ids.next(),
    projectId: input.projectId,
    name,
    description,
    createdBy: input.actorId,
    createdAt: now,
    updatedAt: now,
  };
  deps.todos.insertList(list);
  return ok(list);
}
