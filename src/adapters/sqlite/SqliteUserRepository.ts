import type { UserRepository } from '../../ports/index.js';
import type { Id, User } from '../../domain/types.js';
import type { Db } from './database.js';

interface Row {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

const toUser = (r: Row): User => ({
  id: r.id,
  email: r.email,
  name: r.name,
  passwordHash: r.password_hash,
  createdAt: r.created_at,
});

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  insert(u: User): void {
    this.db
      .prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(u.id, u.email, u.name, u.passwordHash, u.createdAt);
  }

  findById(id: Id): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined;
    return row ? toUser(row) : null;
  }

  findByEmail(email: string): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Row | undefined;
    return row ? toUser(row) : null;
  }

  findManyByIds(ids: readonly Id[]): User[] {
    if (ids.length === 0) return [];
    const rows = this.db
      .prepare('SELECT * FROM users WHERE id IN (SELECT value FROM json_each(?))')
      .all(JSON.stringify(ids)) as Row[];
    return rows.map(toUser);
  }

  list(): User[] {
    return (this.db.prepare('SELECT * FROM users ORDER BY name COLLATE NOCASE, rowid').all() as Row[]).map(toUser);
  }
}
