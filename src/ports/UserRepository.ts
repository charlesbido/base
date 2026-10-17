import type { Id, User } from '../domain/types.js';

export interface UserRepository {
  insert(user: User): void;
  findById(id: Id): User | null;
  /** Lookup by email; callers pass the normalised (lower-cased) address. */
  findByEmail(email: string): User | null;
  findManyByIds(ids: readonly Id[]): User[];
  /** All users, ordered by name. */
  list(): User[];
}
