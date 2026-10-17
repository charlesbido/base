import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import type { Id } from '../types.js';
import type { ProjectCard } from '../views.js';

export interface ListProjectsInput {
  actorId: Id;
}

export type ListProjectsDeps = Pick<CampDeps, 'projects'>;

/** Projects the actor belongs to, most recently updated first. */
export function listProjects(deps: ListProjectsDeps, input: ListProjectsInput): Result<ProjectCard[]> {
  return ok(
    deps.projects.listForUser(input.actorId).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      memberCount: deps.projects.listMemberIds(p.id).length,
      updatedAt: p.updatedAt,
    })),
  );
}
