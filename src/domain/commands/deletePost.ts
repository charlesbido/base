import type { CampDeps } from '../../ports/index.js';
import { fail, notFound, ok, type Result } from '../result.js';
import { requireMember } from '../shared.js';
import type { Id } from '../types.js';

export interface DeletePostInput {
  actorId: Id;
  postId: Id;
}

export type DeletePostDeps = Pick<CampDeps, 'projects' | 'posts'>;

/** Only the author may delete a post (its comments go with it). */
export function deletePost(deps: DeletePostDeps, input: DeletePostInput): Result<{ id: Id }> {
  const post = deps.posts.findById(input.postId);
  if (!post) return notFound('Post');
  const access = requireMember(deps.projects, post.projectId, input.actorId);
  if (!access.ok) return access;
  if (post.authorId !== input.actorId) return fail('forbidden', 'Only the author can delete this post');
  deps.posts.delete(post.id);
  return ok({ id: post.id });
}
