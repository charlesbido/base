import type { EventRange, ScheduleRepository } from '../../ports/index.js';
import type { Id, ScheduleEvent } from '../../domain/types.js';
import type { Db } from './database.js';

interface Row {
  id: string;
  project_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const toEvent = (r: Row): ScheduleEvent => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  description: r.description,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class SqliteScheduleRepository implements ScheduleRepository {
  constructor(private readonly db: Db) {}

  insert(e: ScheduleEvent): void {
    this.db
      .prepare(
        `INSERT INTO events (id, project_id, title, description, starts_at, ends_at, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(e.id, e.projectId, e.title, e.description, e.startsAt, e.endsAt, e.createdBy, e.createdAt, e.updatedAt);
  }

  update(e: ScheduleEvent): void {
    this.db
      .prepare('UPDATE events SET title = ?, description = ?, starts_at = ?, ends_at = ?, updated_at = ? WHERE id = ?')
      .run(e.title, e.description, e.startsAt, e.endsAt, e.updatedAt, e.id);
  }

  delete(id: Id): void {
    this.db.prepare('DELETE FROM events WHERE id = ?').run(id);
  }

  findById(id: Id): ScheduleEvent | null {
    const r = this.db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Row | undefined;
    return r ? toEvent(r) : null;
  }

  /** ISO-8601 UTC strings sort lexicographically, so string comparison is time comparison. */
  listByProject(projectId: Id, range: EventRange = {}): ScheduleEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM events
         WHERE project_id = @projectId
           AND (@from IS NULL OR ends_at >= @from)
           AND (@to IS NULL OR starts_at < @to)
         ORDER BY starts_at, rowid`,
      )
      .all({ projectId, from: range.from ?? null, to: range.to ?? null }) as Row[];
    return rows.map(toEvent);
  }
}
