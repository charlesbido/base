import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Doc, Id } from '../types.js';
import { Validator } from '../validation.js';

export interface UpdateDocInput {
  actorId: Id;
  docId: Id;
  title?: string;
  body?: string;
}

export type UpdateDocDeps = Pick<CampDeps, 'projects' | 'docs' | 'clock'>;

/** Docs are collaborative: any project member may edit. Last write wins. */
export function updateDoc(deps: UpdateDocDeps, input: UpdateDocInput): Result<Doc> {
  const doc = deps.docs.findById(input.docId);
  if (!doc) return notFound('Doc');
  const access = requireMember(deps.projects, doc.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const title = v.patchRequiredString(input.title, 'title', 200);
  const body = v.patchOptionalString(input.body, 'body', 200_000);
  const invalid = v.failure();
  if (invalid) return invalid;

  const updated: Doc = {
    ...doc,
    title: title ?? doc.title,
    body: body ?? doc.body,
    updatedBy: input.actorId,
    updatedAt: nowIso(deps.clock),
  };
  deps.docs.update(updated);
  return ok(updated);
}
