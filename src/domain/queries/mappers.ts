/** Entity -> view mappers shared by several queries (not a handler). */
import type { CampDeps } from '../../ports/index.js';
import { userDirectory } from '../shared.js';
import type { Comment, CommentParentType, Id, Todo, UserSummary } from '../types.js';
import type { CommentView, TodoView } from '../views.js';

type Lookup = (id: Id | null) => UserSummary | null;

export function todoView(todo: Todo, user: Lookup, commentCount: number): TodoView {
  return {
    id: todo.id,
    projectId: todo.projectId,
    listId: todo.listId,
    title: todo.title,
    description: todo.description,
    assignee: user(todo.assigneeId),
    dueDate: todo.dueDate,
    done: todo.done,
    completedAt: todo.completedAt,
    createdBy: user(todo.createdBy),
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    commentCount,
  };
}

export function commentViews(
  deps: Pick<CampDeps, 'comments' | 'users'>,
  parentType: CommentParentType,
  parentId: Id,
): CommentView[] {
  const comments: Comment[] = deps.comments.listForParent(parentType, parentId);
  const user = userDirectory(deps.users, comments.map((c) => c.authorId));
  return comments.map((c) => ({
    id: c.id,
    parentType: c.parentType,
    parentId: c.parentId,
    body: c.body,
    author: user(c.authorId),
    createdAt: c.createdAt,
  }));
}
