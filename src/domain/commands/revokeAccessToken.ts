import type { CampDeps } from '../../ports/index.js';
import { fail, notFound, ok, type Result } from '../result.js';
import { nowIso } from '../shared.js';
import type { Id } from '../types.js';

export interface RevokeAccessTokenInput {
  actorId: Id;
  tokenId: Id;
}

export type RevokeAccessTokenDeps = Pick<CampDeps, 'accessTokens' | 'clock'>;

/** Revoking is permanent and idempotent; only the token's owner may do it. */
export function revokeAccessToken(deps: RevokeAccessTokenDeps, input: RevokeAccessTokenInput): Result<{ id: Id }> {
  const existing = deps.accessTokens.findById(input.tokenId);
  if (!existing) return notFound('Access token');
  if (existing.userId !== input.actorId) return fail('forbidden', 'Not your access token');
  if (!existing.revokedAt) deps.accessTokens.revoke(existing.id, nowIso(deps.clock));
  return ok({ id: existing.id });
}
