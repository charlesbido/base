import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { nowIso, requireMember, toUserSummary } from '../shared.js';
import type { Id, User, UserSummary } from '../types.js';
import { Validator } from '../validation.js';

export interface AddProjectMemberInput {
  actorId: Id;
  projectId: Id;
  /** Identify the person by id or by email (exactly one). */
  userId?: Id;
  email?: string;
}

export type AddProjectMemberDeps = Pick<CampDeps, 'projects' | 'users' | 'clock'>;

/** Any member may invite another existing user. Adding an existing member is a no-op. */
export function addProjectMember(
  deps: AddProjectMemberDeps,
  input: AddProjectMemberInput,
): Result<UserSummary> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  let user: User | null = null;
  if (input.userId !== undefined && input.userId !== null && input.userId !== '') {
    user = deps.users.findById(v.id(input.userId, 'userId'));
  } else if (input.email !== undefined) {
    user = deps.users.findByEmail(v.email(input.email));
  } else {
    v.check(false, 'userId', 'userId or email is required');
  }
  const invalid = v.failure();
  if (invalid) return invalid;
  if (!user) return notFound('User');

  if (!deps.projects.isMember(input.projectId, user.id)) {
    deps.projects.addMember(input.projectId, user.id, nowIso(deps.clock));
  }
  return ok(toUserSummary(user));
}
