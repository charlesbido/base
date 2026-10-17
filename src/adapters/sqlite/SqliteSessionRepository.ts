import type { SessionRepository } from '../../ports/index.js';
import type { Session } from '../../domain/types.js';
import type { Db } from './database.js';

interface Row {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export class SqliteSessionRepository implements SessionRepository {
  constructor(private readonly db: Db) {}

  insert(s: Session): void {
    this.db
      .prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(s.token, s.userId, s.createdAt, s.expiresAt);
  }

  findByToken(token: string): Session | null {
    const r = this.db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) as Row | undefined;
    return r ? { token: r.token, userId: r.user_id, createdAt: r.created_at, expiresAt: r.expires_at } : null;
  }

  delete(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
}
