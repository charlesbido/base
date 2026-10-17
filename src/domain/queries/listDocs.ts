import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { excerpt, requireMember, userDirectory } from '../shared.js';
import type { Id } from '../types.js';
import type { DocSummary } from '../views.js';

export interface ListDocsInput {
  actorId: Id;
  projectId: Id;
}

export type ListDocsDeps = Pick<CampDeps, 'projects' | 'docs' | 'users'>;

/** Docs index, most recently updated first. */
export function listDocs(deps: ListDocsDeps, input: ListDocsInput): Result<DocSummary[]> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;

  const docs = deps.docs.listByProject(input.projectId);
  const user = userDirectory(deps.users, docs.map((d) => d.updatedBy));
  return ok(
    docs.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      title: d.title,
      excerpt: excerpt(d.body),
      updatedBy: user(d.updatedBy),
      updatedAt: d.updatedAt,
    })),
  );
}
