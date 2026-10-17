import type { CampDeps } from '../../ports/index.js';
import { fail, notFound, ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Id, Post } from '../types.js';
import { Validator } from '../validation.js';

export interface UpdatePostInput {
  actorId: Id;
  postId: Id;
  title?: string;
  body?: string;
}

export type UpdatePostDeps = Pick<CampDeps, 'projects' | 'posts' | 'clock'>;

/** Only the author may edit a post. */
export function updatePost(deps: UpdatePostDeps, input: UpdatePostInput): Result<Post> {
  const post = deps.posts.findById(input.postId);
  if (!post) return notFound('Post');
  const access = requireMember(deps.projects, post.projectId, input.actorId);
  if (!access.ok) return access;
  if (post.authorId !== input.actorId) return fail('forbidden', 'Only the author can edit this post');

  const v = new Validator();
  const title = v.patchRequiredString(input.title, 'title', 200);
  const body = v.patchRequiredString(input.body, 'body', 50_000);
  const invalid = v.failure();
  if (invalid) return invalid;

  const updated: Post = {
    ...post,
    title: title ?? post.title,
    body: body ?? post.body,
    updatedAt: nowIso(deps.clock),
  };
  deps.posts.update(updated);
  return ok(updated);
}
