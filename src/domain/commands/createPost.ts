import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Id, Post } from '../types.js';
import { Validator } from '../validation.js';

export interface CreatePostInput {
  actorId: Id;
  projectId: Id;
  title: string;
  body: string;
}

export type CreatePostDeps = Pick<CampDeps, 'projects' | 'posts' | 'ids' | 'clock'>;

export function createPost(deps: CreatePostDeps, input: CreatePostInput): Result<Post> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const title = v.requiredString(input.title, 'title', 200);
  const body = v.requiredString(input.body, 'body', 50_000);
  const invalid = v.failure();
  if (invalid) return invalid;

  const now = nowIso(deps.clock);
  const post: Post = {
    id: deps.ids.next(),
    projectId: input.projectId,
    title,
    body,
    authorId: input.actorId,
    createdAt: now,
    updatedAt: now,
  };
  deps.posts.insert(post);
  return ok(post);
}
