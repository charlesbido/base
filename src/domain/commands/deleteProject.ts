import type { CampDeps } from '../../ports/index.js';
import { fail, ok, type Result } from '../result.js';
import { requireMember } from '../shared.js';
import type { Id } from '../types.js';

export interface DeleteProjectInput {
  actorId: Id;
  projectId: Id;
}

export type DeleteProjectDeps = Pick<CampDeps, 'projects'>;

/** Only the project's creator may delete it (and everything in it). */
export function deleteProject(deps: DeleteProjectDeps, input: DeleteProjectInput): Result<{ id: Id }> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;
  if (access.project.createdBy !== input.actorId) {
    return fail('forbidden', 'Only the project creator can delete this project');
  }
  deps.projects.delete(input.projectId);
  return ok({ id: input.projectId });
}
