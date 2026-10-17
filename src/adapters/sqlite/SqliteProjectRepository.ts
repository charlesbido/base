import type { ProjectRepository } from '../../ports/index.js';
import type { Id, ISODateTime, Project } from '../../domain/types.js';
import type { Db } from './database.js';

interface Row {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const toProject = (r: Row): Project => ({
  id: r.id,
  name: r.name,
  description: r.description,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: Db) {}

  insert(p: Project, memberIds: readonly Id[]): void {
    this.db.transaction(() => {
      this.db
        .prepare(
          'INSERT INTO projects (id, name, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(p.id, p.name, p.description, p.createdBy, p.createdAt, p.updatedAt);
      for (const userId of memberIds) this.addMember(p.id, userId, p.createdAt);
    })();
  }

  update(p: Project): void {
    this.db
      .prepare('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?')
      .run(p.name, p.description, p.updatedAt, p.id);
  }

  /** Everything project-scoped goes via ON DELETE CASCADE. */
  delete(id: Id): void {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  findById(id: Id): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row | undefined;
    return row ? toProject(row) : null;
  }

  listForUser(userId: Id): Project[] {
    const rows = this.db
      .prepare(
        `SELECT p.* FROM projects p
         JOIN project_members m ON m.project_id = p.id
         WHERE m.user_id = ?
         ORDER BY p.updated_at DESC, p.rowid DESC`,
      )
      .all(userId) as Row[];
    return rows.map(toProject);
  }

  addMember(projectId: Id, userId: Id, addedAt: ISODateTime): void {
    this.db
      .prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, added_at) VALUES (?, ?, ?)')
      .run(projectId, userId, addedAt);
  }

  removeMember(projectId: Id, userId: Id): void {
    this.db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, userId);
  }

  isMember(projectId: Id, userId: Id): boolean {
    return (
      this.db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId) !==
      undefined
    );
  }

  listMemberIds(projectId: Id): Id[] {
    return this.db
      .prepare('SELECT user_id FROM project_members WHERE project_id = ? ORDER BY added_at, rowid')
      .pluck()
      .all(projectId) as Id[];
  }
}
