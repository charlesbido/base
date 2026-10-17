import type { Session } from '../domain/types.js';

export interface SessionRepository {
  insert(session: Session): void;
  findByToken(token: string): Session | null;
  delete(token: string): void;
}
