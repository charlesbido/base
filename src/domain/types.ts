/**
 * Domain types. Pure data — no behaviour, no I/O.
 *
 * Timestamps are ISO-8601 UTC strings (e.g. "2026-10-17T12:00:00.000Z").
 * Calendar dates without time (to-do due dates) are "YYYY-MM-DD" strings.
 */

export type Id = string;
export type ISODateTime = string;
export type ISODate = string;

export interface User {
  id: Id;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: ISODateTime;
}

/** The public face of a User — never exposes the password hash. */
export interface UserSummary {
  id: Id;
  email: string;
  name: string;
}

export interface Session {
  token: string;
  userId: Id;
  createdAt: ISODateTime;
  expiresAt: ISODateTime;
}

/**
 * A long-lived personal access token: an alternative to a browser Session for scripts and MCP
 * clients, which can't go through the 30-day login/cookie dance. Only `tokenHash` is persisted —
 * the raw value is shown once, at creation.
 */
export interface AccessToken {
  id: Id;
  userId: Id;
  name: string;
  tokenHash: string;
  createdAt: ISODateTime;
  /** null = never expires. */
  expiresAt: ISODateTime | null;
  /** null = still active. */
  revokedAt: ISODateTime | null;
}

export interface Project {
  id: Id;
  name: string;
  description: string;
  createdBy: Id;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TodoList {
  id: Id;
  projectId: Id;
  name: string;
  description: string;
  createdBy: Id;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Todo {
  id: Id;
  projectId: Id;
  listId: Id;
  title: string;
  description: string;
  assigneeId: Id | null;
  dueDate: ISODate | null;
  done: boolean;
  completedAt: ISODateTime | null;
  createdBy: Id;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type CommentParentType = 'todo' | 'post';

export interface Comment {
  id: Id;
  projectId: Id;
  parentType: CommentParentType;
  parentId: Id;
  authorId: Id;
  body: string;
  createdAt: ISODateTime;
}

/** A Message Board post. Body is lightweight markdown ("rich-ish" text). */
export interface Post {
  id: Id;
  projectId: Id;
  title: string;
  body: string;
  authorId: Id;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Doc {
  id: Id;
  projectId: Id;
  title: string;
  body: string;
  authorId: Id;
  updatedBy: Id;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** A Schedule (calendar) event. Named ScheduleEvent to avoid clashing with the DOM `Event`. */
export interface ScheduleEvent {
  id: Id;
  projectId: Id;
  title: string;
  description: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  createdBy: Id;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** A Campfire (chat) line. */
export interface ChatMessage {
  id: Id;
  projectId: Id;
  authorId: Id;
  body: string;
  createdAt: ISODateTime;
}
