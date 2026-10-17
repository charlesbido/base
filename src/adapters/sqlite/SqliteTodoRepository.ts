import type { TodoRepository } from '../../ports/index.js';
import type { Id, Todo, TodoList } from '../../domain/types.js';
import type { Db } from './database.js';

interface ListRow {
  id: string;
  project_id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TodoRow {
  id: string;
  project_id: string;
  list_id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  due_date: string | null;
  done: number;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const toList = (r: ListRow): TodoList => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  description: r.description,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toTodo = (r: TodoRow): Todo => ({
  id: r.id,
  projectId: r.project_id,
  listId: r.list_id,
  title: r.title,
  description: r.description,
  assigneeId: r.assignee_id,
  dueDate: r.due_date,
  done: r.done === 1,
  completedAt: r.completed_at,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class SqliteTodoRepository implements TodoRepository {
  constructor(private readonly db: Db) {}

  insertList(l: TodoList): void {
    this.db
      .prepare(
        'INSERT INTO todo_lists (id, project_id, name, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(l.id, l.projectId, l.name, l.description, l.createdBy, l.createdAt, l.updatedAt);
  }

  updateList(l: TodoList): void {
    this.db
      .prepare('UPDATE todo_lists SET name = ?, description = ?, updated_at = ? WHERE id = ?')
      .run(l.name, l.description, l.updatedAt, l.id);
  }

  /** To-dos and their comments cascade. */
  deleteList(id: Id): void {
    this.db.prepare('DELETE FROM todo_lists WHERE id = ?').run(id);
  }

  findListById(id: Id): TodoList | null {
    const r = this.db.prepare('SELECT * FROM todo_lists WHERE id = ?').get(id) as ListRow | undefined;
    return r ? toList(r) : null;
  }

  listListsByProject(projectId: Id): TodoList[] {
    const rows = this.db
      .prepare('SELECT * FROM todo_lists WHERE project_id = ? ORDER BY created_at, rowid')
      .all(projectId) as ListRow[];
    return rows.map(toList);
  }

  insertTodo(t: Todo): void {
    this.db
      .prepare(
        `INSERT INTO todos (id, project_id, list_id, title, description, assignee_id, due_date, done,
                            completed_at, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        t.id, t.projectId, t.listId, t.title, t.description, t.assigneeId, t.dueDate,
        t.done ? 1 : 0, t.completedAt, t.createdBy, t.createdAt, t.updatedAt,
      );
  }

  updateTodo(t: Todo): void {
    this.db
      .prepare(
        `UPDATE todos SET list_id = ?, title = ?, description = ?, assignee_id = ?, due_date = ?, done = ?,
                          completed_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(t.listId, t.title, t.description, t.assigneeId, t.dueDate, t.done ? 1 : 0, t.completedAt, t.updatedAt, t.id);
  }

  /** Comments cascade. */
  deleteTodo(id: Id): void {
    this.db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  }

  findTodoById(id: Id): Todo | null {
    const r = this.db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
    return r ? toTodo(r) : null;
  }

  listTodosByProject(projectId: Id): Todo[] {
    const rows = this.db
      .prepare('SELECT * FROM todos WHERE project_id = ? ORDER BY created_at, rowid')
      .all(projectId) as TodoRow[];
    return rows.map(toTodo);
  }
}
