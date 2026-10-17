import type { Comment, CommentParentType, Id } from '../domain/types.js';

export interface CommentRepository {
  insert(comment: Comment): void;
  delete(id: Id): void;
  findById(id: Id): Comment | null;
  /** Comments on one parent, oldest first. */
  listForParent(parentType: CommentParentType, parentId: Id): Comment[];
  /** Comment counts keyed by parent id (parents with no comments may be absent). */
  countForParents(parentType: CommentParentType, parentIds: readonly Id[]): Map<Id, number>;
}
