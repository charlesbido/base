import type { CommentRepository } from '../../ports/index.js';
import type { Comment, CommentParentType, Id } from '../../domain/types.js';
import type { Db } from './database.js';

interface Row {
  id: string;
  project_id: string;
  todo_id: string | null;
  post_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
}

const PARENT_COLUMN: Record<CommentParentType, 'todo_id' | 'post_id'> = { todo: 'todo_id', post: 'post_id' };

const toComment = (r: Row): Comment => ({
  id: r.id,
  projectId: r.project_id,
  parentType: r.todo_id !== null ? 'todo' : 'post',
  parentId: (r.todo_id ?? r.post_id)!,
  authorId: r.author_id,
  body: r.body,
  createdAt: r.created_at,
});

export class SqliteCommentRepository implements CommentRepository {
  constructor(private readonly db: Db) {}

  insert(c: Comment): void {
    this.db
      .prepare(
        'INSERT INTO comments (id, project_id, todo_id, post_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        c.id, c.projectId,
        c.parentType === 'todo' ? c.parentId : null,
        c.parentType === 'post' ? c.parentId : null,
        c.authorId, c.body, c.createdAt,
      );
  }

  delete(id: Id): void {
    this.db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  }

  findById(id: Id): Comment | null {
    const r = this.db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as Row | undefined;
    return r ? toComment(r) : null;
  }

  listForParent(parentType: CommentParentType, parentId: Id): Comment[] {
    const col = PARENT_COLUMN[parentType];
    const rows = this.db
      .prepare(`SELECT * FROM comments WHERE ${col} = ? ORDER BY created_at, rowid`)
      .all(parentId) as Row[];
    return rows.map(toComment);
  }

  countForParents(parentType: CommentParentType, parentIds: readonly Id[]): Map<Id, number> {
    if (parentIds.length === 0) return new Map();
    const col = PARENT_COLUMN[parentType];
    const rows = this.db
      .prepare(
        `SELECT ${col} AS parent_id, COUNT(*) AS n FROM comments
         WHERE ${col} IN (SELECT value FROM json_each(?)) GROUP BY ${col}`,
      )
      .all(JSON.stringify(parentIds)) as { parent_id: string; n: number }[];
    return new Map(rows.map((r) => [r.parent_id, r.n]));
  }
}
