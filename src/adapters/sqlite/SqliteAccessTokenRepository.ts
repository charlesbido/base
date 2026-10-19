import type { AccessTokenRepository } from '../../ports/index.js';
import type { AccessToken } from '../../domain/types.js';
import type { Db } from './database.js';

interface Row {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

const toDomain = (r: Row): AccessToken => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  tokenHash: r.token_hash,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  revokedAt: r.revoked_at,
});

export class SqliteAccessTokenRepository implements AccessTokenRepository {
  constructor(private readonly db: Db) {}

  insert(t: AccessToken): void {
    this.db
      .prepare(
        'INSERT INTO access_tokens (id, user_id, name, token_hash, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(t.id, t.userId, t.name, t.tokenHash, t.createdAt, t.expiresAt, t.revokedAt);
  }

  findByHash(tokenHash: string): AccessToken | null {
    const r = this.db.prepare('SELECT * FROM access_tokens WHERE token_hash = ?').get(tokenHash) as Row | undefined;
    return r ? toDomain(r) : null;
  }

  findById(id: string): AccessToken | null {
    const r = this.db.prepare('SELECT * FROM access_tokens WHERE id = ?').get(id) as Row | undefined;
    return r ? toDomain(r) : null;
  }

  listByUser(userId: string): AccessToken[] {
    const rows = this.db
      .prepare('SELECT * FROM access_tokens WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as Row[];
    return rows.map(toDomain);
  }

  revoke(id: string, revokedAt: string): void {
    this.db.prepare('UPDATE access_tokens SET revoked_at = ? WHERE id = ?').run(revokedAt, id);
  }
}
