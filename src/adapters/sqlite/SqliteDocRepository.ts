import type { DocRepository } from '../../ports/index.js';
import type { Doc, Id } from '../../domain/types.js';
import type { Db } from './database.js';

interface Row {
  id: string;
  project_id: string;
  title: string;
  body: string;
  author_id: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

const toDoc = (r: Row): Doc => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  body: r.body,
  authorId: r.author_id,
  updatedBy: r.updated_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class SqliteDocRepository implements DocRepository {
  constructor(private readonly db: Db) {}

  insert(d: Doc): void {
    this.db
      .prepare(
        `INSERT INTO docs (id, project_id, title, body, author_id, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(d.id, d.projectId, d.title, d.body, d.authorId, d.updatedBy, d.createdAt, d.updatedAt);
  }

  update(d: Doc): void {
    this.db
      .prepare('UPDATE docs SET title = ?, body = ?, updated_by = ?, updated_at = ? WHERE id = ?')
      .run(d.title, d.body, d.updatedBy, d.updatedAt, d.id);
  }

  delete(id: Id): void {
    this.db.prepare('DELETE FROM docs WHERE id = ?').run(id);
  }

  findById(id: Id): Doc | null {
    const r = this.db.prepare('SELECT * FROM docs WHERE id = ?').get(id) as Row | undefined;
    return r ? toDoc(r) : null;
  }

  listByProject(projectId: Id): Doc[] {
    const rows = this.db
      .prepare('SELECT * FROM docs WHERE project_id = ? ORDER BY updated_at DESC, rowid DESC')
      .all(projectId) as Row[];
    return rows.map(toDoc);
  }
}
