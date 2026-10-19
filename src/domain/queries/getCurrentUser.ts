import type { CampDeps } from '../../ports/index.js';
import { fail, ok, type Result } from '../result.js';
import { toUserSummary } from '../shared.js';
import type { UserSummary } from '../types.js';

export interface GetCurrentUserInput {
  token: string;
}

export type GetCurrentUserDeps = Pick<CampDeps, 'sessions' | 'accessTokens' | 'users' | 'tokens' | 'clock'>;

/**
 * Resolves a bearer credential to the signed-in user. Accepts either a 30-day Session token (from
 * `login`) or a long-lived personal access token (from `createAccessToken`) — the same header or
 * cookie slot works for both, so callers never need to know which kind they were given.
 */
export function getCurrentUser(deps: GetCurrentUserDeps, input: GetCurrentUserInput): Result<UserSummary> {
  const unauthorized = fail('unauthorized', 'Not signed in');
  if (typeof input.token !== 'string' || input.token === '') return unauthorized;
  const now = deps.clock.now().toISOString();

  const session = deps.sessions.findByToken(input.token);
  if (session && session.expiresAt > now) {
    const user = deps.users.findById(session.userId);
    return user ? ok(toUserSummary(user)) : unauthorized;
  }

  const accessToken = deps.accessTokens.findByHash(deps.tokens.hash(input.token));
  if (accessToken && !accessToken.revokedAt && (accessToken.expiresAt === null || accessToken.expiresAt > now)) {
    const user = deps.users.findById(accessToken.userId);
    return user ? ok(toUserSummary(user)) : unauthorized;
  }

  return unauthorized;
}
