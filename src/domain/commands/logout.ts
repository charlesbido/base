import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';

export interface LogoutInput {
  token: string;
}

export type LogoutDeps = Pick<CampDeps, 'sessions'>;

/** Ends a session. Idempotent: logging out an unknown token succeeds. */
export function logout(deps: LogoutDeps, input: LogoutInput): Result<{ loggedOut: true }> {
  if (typeof input.token === 'string' && input.token !== '') deps.sessions.delete(input.token);
  return ok({ loggedOut: true });
}
