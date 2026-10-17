import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { toUserSummary } from '../shared.js';
import type { Id, UserSummary } from '../types.js';

export interface ListUsersInput {
  actorId: Id;
}

export type ListUsersDeps = Pick<CampDeps, 'users'>;

/** The People directory: every account on this Camp instance (single-tenant v1). */
export function listUsers(deps: ListUsersDeps, _input: ListUsersInput): Result<UserSummary[]> {
  return ok(deps.users.list().map(toUserSummary));
}
