import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Id, Todo } from '../types.js';
import { Validator } from '../validation.js';

export interface SetTodoCompletionInput {
  actorId: Id;
  todoId: Id;
  done: boolean;
}

export type SetTodoCompletionDeps = Pick<CampDeps, 'projects' | 'todos' | 'clock'>;

/** Marks a to-do done or not-done. Idempotent: re-completing keeps the original completedAt. */
export function setTodoCompletion(
  deps: SetTodoCompletionDeps,
  input: SetTodoCompletionInput,
): Result<Todo> {
  const v = new Validator();
  const done = v.boolean(input.done, 'done');
  const invalid = v.failure();
  if (invalid) return invalid;

  const todo = deps.todos.findTodoById(input.todoId);
  if (!todo) return notFound('To-do');
  const access = requireMember(deps.projects, todo.projectId, input.actorId);
  if (!access.ok) return access;
  if (todo.done === done) return ok(todo);

  const now = nowIso(deps.clock);
  const updated: Todo = { ...todo, done, completedAt: done ? now : null, updatedAt: now };
  deps.todos.updateTodo(updated);
  return ok(updated);
}
