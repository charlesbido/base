import type { PostRepository } from '../../ports/index.js';
import type { Id, Post } from '../../domain/types.js';
import type { Db } from './database.js';

interface Row {
  id: string;
  project_id: string;
  title: string;
  body: string;
  author_id: string;
  created_at: string;
  updated_at: string;
}

const toPost = (r: Row): Post => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  body: r.body,
  authorId: r.author_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class SqlitePostRepository implements PostRepository {
  constructor(private readonly db: Db) {}

  insert(p: Post): void {
    this.db
      .prepare(
        'INSERT INTO posts (id, project_id, title, body, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(p.id, p.projectId, p.title, p.body, p.authorId, p.createdAt, p.updatedAt);
  }

  update(p: Post): void {
    this.db.prepare('UPDATE posts SET title = ?, body = ?, updated_at = ? WHERE id = ?').run(p.title, p.body, p.updatedAt, p.id);
  }

  /** Comments cascade. */
  delete(id: Id): void {
    this.db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  }

  findById(id: Id): Post | null {
    const r = this.db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Row | undefined;
    return r ? toPost(r) : null;
  }

  listByProject(projectId: Id): Post[] {
    const rows = this.db
      .prepare('SELECT * FROM posts WHERE project_id = ? ORDER BY created_at DESC, rowid DESC')
      .all(projectId) as Row[];
    return rows.map(toPost);
  }
}
