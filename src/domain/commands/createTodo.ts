import type { CampDeps } from '../../ports/index.js';
import { fail, notFound, ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Id, ISODate, Todo } from '../types.js';
import { Validator } from '../validation.js';

export interface CreateTodoInput {
  actorId: Id;
  listId: Id;
  title: string;
  description?: string;
  assigneeId?: Id | null;
  dueDate?: ISODate | null;
}

export type CreateTodoDeps = Pick<CampDeps, 'projects' | 'todos' | 'ids' | 'clock'>;

export function createTodo(deps: CreateTodoDeps, input: CreateTodoInput): Result<Todo> {
  const list = deps.todos.findListById(input.listId);
  if (!list) return notFound('To-do list');
  const access = requireMember(deps.projects, list.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const title = v.requiredString(input.title, 'title', 200);
  const description = v.optionalString(input.description, 'description', 10_000);
  const assigneeId = v.patchNullableId(input.assigneeId, 'assigneeId') ?? null;
  const dueDate = v.patchNullableDate(input.dueDate, 'dueDate') ?? null;
  const invalid = v.failure();
  if (invalid) return invalid;

  const assigneeError = checkAssignee(deps, list.projectId, assigneeId);
  if (assigneeError) return assigneeError;

  const now = nowIso(deps.clock);
  const todo: Todo = {
    id: deps.ids.next(),
    projectId: list.projectId,
    listId: list.id,
    title,
    description,
    assigneeId,
    dueDate,
    done: false,
    completedAt: null,
    createdBy: input.actorId,
    createdAt: now,
    updatedAt: now,
  };
  deps.todos.insertTodo(todo);
  return ok(todo);
}

/** A to-do can only be assigned to a member of its project. */
export function checkAssignee(
  deps: Pick<CampDeps, 'projects'>,
  projectId: Id,
  assigneeId: Id | null | undefined,
) {
  if (assigneeId && !deps.projects.isMember(projectId, assigneeId)) {
    return fail('validation', 'Assignee must be a member of the project', {
      assigneeId: 'not a project member',
    });
  }
  return null;
}
