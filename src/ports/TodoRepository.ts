import type { Id, Todo, TodoList } from '../domain/types.js';

export interface TodoRepository {
  insertList(list: TodoList): void;
  updateList(list: TodoList): void;
  /** Deletes the list, its to-dos, and the comments on those to-dos. */
  deleteList(id: Id): void;
  findListById(id: Id): TodoList | null;
  /** Lists in creation order. */
  listListsByProject(projectId: Id): TodoList[];

  insertTodo(todo: Todo): void;
  updateTodo(todo: Todo): void;
  /** Deletes the to-do and its comments. */
  deleteTodo(id: Id): void;
  findTodoById(id: Id): Todo | null;
  /** All to-dos in a project, in creation order. */
  listTodosByProject(projectId: Id): Todo[];
}
