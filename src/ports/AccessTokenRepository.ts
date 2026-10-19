import type { AccessToken, Id } from '../domain/types.js';

export interface AccessTokenRepository {
  insert(token: AccessToken): void;
  findByHash(tokenHash: string): AccessToken | null;
  findById(id: Id): AccessToken | null;
  listByUser(userId: Id): AccessToken[];
  revoke(id: Id, revokedAt: string): void;
}
