import type { Doc, Id } from '../domain/types.js';

export interface DocRepository {
  insert(doc: Doc): void;
  update(doc: Doc): void;
  delete(id: Id): void;
  findById(id: Id): Doc | null;
  /** Most recently updated first. */
  listByProject(projectId: Id): Doc[];
}
