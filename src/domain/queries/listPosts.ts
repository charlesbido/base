import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { excerpt, requireMember, userDirectory } from '../shared.js';
import type { Id } from '../types.js';
import type { PostSummary } from '../views.js';

export interface ListPostsInput {
  actorId: Id;
  projectId: Id;
}

export type ListPostsDeps = Pick<CampDeps, 'projects' | 'posts' | 'comments' | 'users'>;

/** The Message Board index: newest posts first, with excerpts and comment counts. */
export function listPosts(deps: ListPostsDeps, input: ListPostsInput): Result<PostSummary[]> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;

  const posts = deps.posts.listByProject(input.projectId);
  const counts = deps.comments.countForParents('post', posts.map((p) => p.id));
  const user = userDirectory(deps.users, posts.map((p) => p.authorId));
  return ok(
    posts.map((p) => ({
      id: p.id,
      projectId: p.projectId,
      title: p.title,
      excerpt: excerpt(p.body),
      author: user(p.authorId),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      commentCount: counts.get(p.id) ?? 0,
    })),
  );
}
