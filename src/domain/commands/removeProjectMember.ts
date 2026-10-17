import type { CampDeps } from '../../ports/index.js';
import { fail, notFound, ok, type Result } from '../result.js';
import { requireMember } from '../shared.js';
import type { Id } from '../types.js';

export interface RemoveProjectMemberInput {
  actorId: Id;
  projectId: Id;
  userId: Id;
}

export type RemoveProjectMemberDeps = Pick<CampDeps, 'projects'>;

/**
 * Any member may remove a member (including themselves, i.e. "leave project"),
 * except the project creator, who can never be removed — a project always keeps an owner.
 */
export function removeProjectMember(
  deps: RemoveProjectMemberDeps,
  input: RemoveProjectMemberInput,
): Result<{ projectId: Id; userId: Id }> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;
  if (!deps.projects.isMember(input.projectId, input.userId)) return notFound('Member');
  if (access.project.createdBy === input.userId) {
    return fail('conflict', 'The project creator cannot be removed from the project');
  }
  deps.projects.removeMember(input.projectId, input.userId);
  return ok({ projectId: input.projectId, userId: input.userId });
}
