import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Doc, Id } from '../types.js';
import { Validator } from '../validation.js';

export interface CreateDocInput {
  actorId: Id;
  projectId: Id;
  title: string;
  body?: string;
}

export type CreateDocDeps = Pick<CampDeps, 'projects' | 'docs' | 'ids' | 'clock'>;

export function createDoc(deps: CreateDocDeps, input: CreateDocInput): Result<Doc> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const title = v.requiredString(input.title, 'title', 200);
  const body = v.optionalString(input.body, 'body', 200_000);
  const invalid = v.failure();
  if (invalid) return invalid;

  const now = nowIso(deps.clock);
  const doc: Doc = {
    id: deps.ids.next(),
    projectId: input.projectId,
    title,
    body,
    authorId: input.actorId,
    updatedBy: input.actorId,
    createdAt: now,
    updatedAt: now,
  };
  deps.docs.insert(doc);
  return ok(doc);
}
