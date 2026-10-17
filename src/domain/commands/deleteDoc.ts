import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { requireMember } from '../shared.js';
import type { Id } from '../types.js';

export interface DeleteDocInput {
  actorId: Id;
  docId: Id;
}

export type DeleteDocDeps = Pick<CampDeps, 'projects' | 'docs'>;

export function deleteDoc(deps: DeleteDocDeps, input: DeleteDocInput): Result<{ id: Id }> {
  const doc = deps.docs.findById(input.docId);
  if (!doc) return notFound('Doc');
  const access = requireMember(deps.projects, doc.projectId, input.actorId);
  if (!access.ok) return access;
  deps.docs.delete(doc.id);
  return ok({ id: doc.id });
}
