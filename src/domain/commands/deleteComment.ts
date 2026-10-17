import type { CampDeps } from '../../ports/index.js';
import { fail, notFound, ok, type Result } from '../result.js';
import { requireMember } from '../shared.js';
import type { Id } from '../types.js';

export interface DeleteCommentInput {
  actorId: Id;
  commentId: Id;
}

export type DeleteCommentDeps = Pick<CampDeps, 'projects' | 'comments'>;

/** Only a comment's author may delete it. */
export function deleteComment(deps: DeleteCommentDeps, input: DeleteCommentInput): Result<{ id: Id }> {
  const comment = deps.comments.findById(input.commentId);
  if (!comment) return notFound('Comment');
  const access = requireMember(deps.projects, comment.projectId, input.actorId);
  if (!access.ok) return access;
  if (comment.authorId !== input.actorId) return fail('forbidden', 'Only the author can delete this comment');
  deps.comments.delete(comment.id);
  return ok({ id: comment.id });
}
