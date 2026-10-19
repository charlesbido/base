/**
 * Read models: the shapes each Query returns, tailored to the view that consumes them.
 * The web frontend imports these types directly (type-only) so client and server agree.
 */
import type {
  CommentParentType,
  Id,
  ISODate,
  ISODateTime,
  UserSummary,
} from './types.js';

export type { UserSummary } from './types.js';

export interface SessionView {
  token: string;
  expiresAt: ISODateTime;
  user: UserSummary;
}

/** Returned once, right after creation — it's the only time the raw token is ever shown. */
export interface AccessTokenCreated {
  id: Id;
  name: string;
  token: string;
  createdAt: ISODateTime;
  expiresAt: ISODateTime | null;
}

export interface AccessTokenView {
  id: Id;
  name: string;
  createdAt: ISODateTime;
  expiresAt: ISODateTime | null;
  revoked: boolean;
}

export interface ProjectCard {
  id: Id;
  name: string;
  description: string;
  memberCount: number;
  updatedAt: ISODateTime;
}

export interface ProjectDetail {
  id: Id;
  name: string;
  description: string;
  createdBy: UserSummary | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  members: UserSummary[];
  stats: {
    openTodos: number;
    completedTodos: number;
    posts: number;
    docs: number;
    upcomingEvents: number;
  };
}

export interface TodoView {
  id: Id;
  projectId: Id;
  listId: Id;
  title: string;
  description: string;
  assignee: UserSummary | null;
  dueDate: ISODate | null;
  done: boolean;
  completedAt: ISODateTime | null;
  createdBy: UserSummary | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  commentCount: number;
}

export interface TodoListView {
  id: Id;
  projectId: Id;
  name: string;
  description: string;
  createdAt: ISODateTime;
  todos: TodoView[];
  totalCount: number;
  completedCount: number;
}

export interface CommentView {
  id: Id;
  parentType: CommentParentType;
  parentId: Id;
  body: string;
  author: UserSummary | null;
  createdAt: ISODateTime;
}

export interface TodoDetail extends TodoView {
  list: { id: Id; name: string };
  comments: CommentView[];
}

export interface PostSummary {
  id: Id;
  projectId: Id;
  title: string;
  excerpt: string;
  author: UserSummary | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  commentCount: number;
}

export interface PostDetail {
  id: Id;
  projectId: Id;
  title: string;
  body: string;
  author: UserSummary | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  comments: CommentView[];
}

export interface DocSummary {
  id: Id;
  projectId: Id;
  title: string;
  excerpt: string;
  updatedBy: UserSummary | null;
  updatedAt: ISODateTime;
}

export interface DocDetail {
  id: Id;
  projectId: Id;
  title: string;
  body: string;
  author: UserSummary | null;
  updatedBy: UserSummary | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface EventView {
  id: Id;
  projectId: Id;
  title: string;
  description: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  createdBy: UserSummary | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ChatMessageView {
  id: Id;
  projectId: Id;
  body: string;
  author: UserSummary | null;
  createdAt: ISODateTime;
}

export interface ChatTranscript {
  messages: ChatMessageView[];
  /** Pass back as `since` on the next poll (inclusive; de-dupe by id). */
  cursor: ISODateTime | null;
}
