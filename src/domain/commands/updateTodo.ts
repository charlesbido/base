import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Id, ISODate, Todo } from '../types.js';
import { Validator } from '../validation.js';
import { checkAssignee } from './createTodo.js';

export interface UpdateTodoInput {
  actorId: Id;
  todoId: Id;
  title?: string;
  description?: string;
  /** null clears the assignee. */
  assigneeId?: Id | null;
  /** null clears the due date. */
  dueDate?: ISODate | null;
  /** Optionally move the to-do to another list in the same project. */
  listId?: Id;
}

export type UpdateTodoDeps = Pick<CampDeps, 'projects' | 'todos' | 'clock'>;

export function updateTodo(deps: UpdateTodoDeps, input: UpdateTodoInput): Result<Todo> {
  const todo = deps.todos.findTodoById(input.todoId);
  if (!todo) return notFound('To-do');
  const access = requireMember(deps.projects, todo.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const title = v.patchRequiredString(input.title, 'title', 200);
  const description = v.patchOptionalString(input.description, 'description', 10_000);
  const assigneeId = v.patchNullableId(input.assigneeId, 'assigneeId');
  const dueDate = v.patchNullableDate(input.dueDate, 'dueDate');
  const listId = input.listId === undefined ? undefined : v.id(input.listId, 'listId');
  const invalid = v.failure();
  if (invalid) return invalid;

  const assigneeError = checkAssignee(deps, todo.projectId, assigneeId);
  if (assigneeError) return assigneeError;
  if (listId !== undefined && listId !== todo.listId) {
    const target = deps.todos.findListById(listId);
    if (!target || target.projectId !== todo.projectId) return notFound('To-do list');
  }

  const updated: Todo = {
    ...todo,
    title: title ?? todo.title,
    description: description ?? todo.description,
    assigneeId: assigneeId === undefined ? todo.assigneeId : assigneeId,
    dueDate: dueDate === undefined ? todo.dueDate : dueDate,
    listId: listId ?? todo.listId,
    updatedAt: nowIso(deps.clock),
  };
  deps.todos.updateTodo(updated);
  return ok(updated);
}
