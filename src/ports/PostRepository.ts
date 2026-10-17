import type { Id, Post } from '../domain/types.js';

export interface PostRepository {
  insert(post: Post): void;
  update(post: Post): void;
  /** Deletes the post and its comments. */
  delete(id: Id): void;
  findById(id: Id): Post | null;
  /** Newest first. */
  listByProject(projectId: Id): Post[];
}
