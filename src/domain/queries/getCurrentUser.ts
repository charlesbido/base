import type { CampDeps } from '../../ports/index.js';
import { fail, ok, type Result } from '../result.js';
import { toUserSummary } from '../shared.js';
import type { UserSummary } from '../types.js';

export interface GetCurrentUserInput {
  token: string;
}

export type GetCurrentUserDeps = Pick<CampDeps, 'sessions' | 'users' | 'clock'>;

/** Resolves a session token to the signed-in user. Expired or unknown tokens are unauthorized. */
export function getCurrentUser(deps: GetCurrentUserDeps, input: GetCurrentUserInput): Result<UserSummary> {
  const unauthorized = fail('unauthorized', 'Not signed in');
  if (typeof input.token !== 'string' || input.token === '') return unauthorized;
  const session = deps.sessions.findByToken(input.token);
  if (!session || session.expiresAt <= deps.clock.now().toISOString()) return unauthorized;
  const user = deps.users.findById(session.userId);
  return user ? ok(toUserSummary(user)) : unauthorized;
}
