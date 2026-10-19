import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import type { Id } from '../types.js';
import type { AccessTokenView } from '../views.js';

export interface ListAccessTokensInput {
  actorId: Id;
}

export type ListAccessTokensDeps = Pick<CampDeps, 'accessTokens'>;

/** Lists the caller's own access tokens, newest first. Never includes the raw token or its hash. */
export function listAccessTokens(deps: ListAccessTokensDeps, input: ListAccessTokensInput): Result<AccessTokenView[]> {
  const tokens = deps.accessTokens.listByUser(input.actorId);
  return ok(
    tokens.map((t) => ({ id: t.id, name: t.name, createdAt: t.createdAt, expiresAt: t.expiresAt, revoked: t.revokedAt !== null })),
  );
}
