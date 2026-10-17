/** Helpers shared by command and query handlers. Pure functions over ports. */
import type { ProjectRepository, UserRepository } from '../ports/index.js';
import { fail, notFound, type Failure } from './result.js';
import type { Id, Project, User, UserSummary } from './types.js';

export const toUserSummary = (u: User): UserSummary => ({ id: u.id, email: u.email, name: u.name });

/**
 * Every project-scoped action requires the actor to be a member of the project.
 * Returns the project on success, or a Failure.
 */
export function requireMember(
  projects: ProjectRepository,
  projectId: Id,
  actorId: Id,
): { ok: true; project: Project } | Failure {
  const project = projects.findById(projectId);
  if (!project) return notFound('Project');
  if (!projects.isMember(projectId, actorId)) {
    return fail('forbidden', 'You are not a member of this project');
  }
  return { ok: true, project };
}

/** Resolves a batch of user ids to summaries in one repository call. */
export function userDirectory(users: UserRepository, ids: Iterable<Id | null>) {
  const unique = [...new Set([...ids].filter((x): x is Id => x !== null))];
  const map = new Map(users.findManyByIds(unique).map((u) => [u.id, toUserSummary(u)]));
  return (id: Id | null): UserSummary | null => (id === null ? null : (map.get(id) ?? null));
}

export function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export const nowIso = (clock: { now(): Date }): string => clock.now().toISOString();
