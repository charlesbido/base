import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { requireMember, userDirectory } from '../shared.js';
import type { Id } from '../types.js';
import type { PostDetail } from '../views.js';
import { commentViews } from './mappers.js';

export interface GetPostInput {
  actorId: Id;
  postId: Id;
}

export type GetPostDeps = Pick<CampDeps, 'projects' | 'posts' | 'comments' | 'users'>;

export function getPost(deps: GetPostDeps, input: GetPostInput): Result<PostDetail> {
  const post = deps.posts.findById(input.postId);
  if (!post) return notFound('Post');
  const access = requireMember(deps.projects, post.projectId, input.actorId);
  if (!access.ok) return access;

  const user = userDirectory(deps.users, [post.authorId]);
  return ok({
    id: post.id,
    projectId: post.projectId,
    title: post.title,
    body: post.body,
    author: user(post.authorId),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    comments: commentViews(deps, 'post', post.id),
  });
}
