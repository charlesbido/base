import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Id, Project } from '../types.js';
import { Validator } from '../validation.js';

export interface UpdateProjectInput {
  actorId: Id;
  projectId: Id;
  name?: string;
  description?: string;
}

export type UpdateProjectDeps = Pick<CampDeps, 'projects' | 'clock'>;

export function updateProject(deps: UpdateProjectDeps, input: UpdateProjectInput): Result<Project> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const name = v.patchRequiredString(input.name, 'name', 120);
  const description = v.patchOptionalString(input.description, 'description', 2000);
  const invalid = v.failure();
  if (invalid) return invalid;

  const updated: Project = {
    ...access.project,
    name: name ?? access.project.name,
    description: description ?? access.project.description,
    updatedAt: nowIso(deps.clock),
  };
  deps.projects.update(updated);
  return ok(updated);
}
