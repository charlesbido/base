import type { Id, ISODateTime, Project } from '../domain/types.js';

export interface ProjectRepository {
  /** Atomically inserts the project and its initial members. */
  insert(project: Project, memberIds: readonly Id[]): void;
  update(project: Project): void;
  /**
   * Deletes the project AND everything scoped to it (to-do lists, to-dos, comments, posts,
   * docs, events, chat messages, memberships).
   */
  delete(id: Id): void;
  findById(id: Id): Project | null;
  /** Projects the user is a member of, most recently updated first. */
  listForUser(userId: Id): Project[];

  addMember(projectId: Id, userId: Id, addedAt: ISODateTime): void;
  removeMember(projectId: Id, userId: Id): void;
  isMember(projectId: Id, userId: Id): boolean;
  /** Member ids in the order they joined. */
  listMemberIds(projectId: Id): Id[];
}
