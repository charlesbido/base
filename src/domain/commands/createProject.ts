import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { nowIso } from '../shared.js';
import type { Id, Project } from '../types.js';
import { Validator } from '../validation.js';

export interface CreateProjectInput {
  actorId: Id;
  name: string;
  description?: string;
}

export type CreateProjectDeps = Pick<CampDeps, 'projects' | 'ids' | 'clock'>;

/** Creates a project; the creator becomes its first member. */
export function createProject(deps: CreateProjectDeps, input: CreateProjectInput): Result<Project> {
  const v = new Validator();
  const name = v.requiredString(input.name, 'name', 120);
  const description = v.optionalString(input.description, 'description', 2000);
  const invalid = v.failure();
  if (invalid) return invalid;

  const now = nowIso(deps.clock);
  const project: Project = {
    id: deps.ids.next(),
    name,
    description,
    createdBy: input.actorId,
    createdAt: now,
    updatedAt: now,
  };
  deps.projects.insert(project, [input.actorId]);
  return ok(project);
}
