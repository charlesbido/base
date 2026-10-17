import type { CampDeps } from '../../ports/index.js';
import { fail, notFound, ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Comment, CommentParentType, Id } from '../types.js';
import { Validator } from '../validation.js';

export interface AddCommentInput {
  actorId: Id;
  parentType: CommentParentType;
  parentId: Id;
  body: string;
}

export type AddCommentDeps = Pick<CampDeps, 'projects' | 'todos' | 'posts' | 'comments' | 'ids' | 'clock'>;

/** Comments can be left on to-dos and on Message Board posts. */
export function addComment(deps: AddCommentDeps, input: AddCommentInput): Result<Comment> {
  const v = new Validator();
  const body = v.requiredString(input.body, 'body', 10_000);
  const invalid = v.failure();
  if (invalid) return invalid;

  let projectId: Id;
  if (input.parentType === 'todo') {
    const todo = deps.todos.findTodoById(input.parentId);
    if (!todo) return notFound('To-do');
    projectId = todo.projectId;
  } else if (input.parentType === 'post') {
    const post = deps.posts.findById(input.parentId);
    if (!post) return notFound('Post');
    projectId = post.projectId;
  } else {
    return fail('validation', 'parentType must be "todo" or "post"', { parentType: 'invalid' });
  }

  const access = requireMember(deps.projects, projectId, input.actorId);
  if (!access.ok) return access;

  const comment: Comment = {
    id: deps.ids.next(),
    projectId,
    parentType: input.parentType,
    parentId: input.parentId,
    authorId: input.actorId,
    body,
    createdAt: nowIso(deps.clock),
  };
  deps.comments.insert(comment);
  return ok(comment);
}
