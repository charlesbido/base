import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { requireMember, userDirectory } from '../shared.js';
import type { Id } from '../types.js';
import type { DocDetail } from '../views.js';

export interface GetDocInput {
  actorId: Id;
  docId: Id;
}

export type GetDocDeps = Pick<CampDeps, 'projects' | 'docs' | 'users'>;

export function getDoc(deps: GetDocDeps, input: GetDocInput): Result<DocDetail> {
  const doc = deps.docs.findById(input.docId);
  if (!doc) return notFound('Doc');
  const access = requireMember(deps.projects, doc.projectId, input.actorId);
  if (!access.ok) return access;

  const user = userDirectory(deps.users, [doc.authorId, doc.updatedBy]);
  return ok({
    id: doc.id,
    projectId: doc.projectId,
    title: doc.title,
    body: doc.body,
    author: user(doc.authorId),
    updatedBy: user(doc.updatedBy),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}
