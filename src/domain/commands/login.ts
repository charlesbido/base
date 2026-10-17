import type { CampDeps } from '../../ports/index.js';
import { fail, ok, type Result } from '../result.js';
import { toUserSummary } from '../shared.js';
import type { Session } from '../types.js';
import { Validator } from '../validation.js';
import type { SessionView } from '../views.js';

export interface LoginInput {
  email: string;
  password: string;
}

export type LoginDeps = Pick<CampDeps, 'users' | 'sessions' | 'passwords' | 'tokens' | 'clock'>;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Verifies credentials and opens a new session. */
export async function login(deps: LoginDeps, input: LoginInput): Promise<Result<SessionView>> {
  const v = new Validator();
  const email = v.email(input.email);
  const password = typeof input.password === 'string' ? input.password : '';
  v.check(password !== '', 'password', 'password is required');
  const invalid = v.failure();
  if (invalid) return invalid;

  const user = deps.users.findByEmail(email);
  // Same message for unknown email and wrong password — don't leak which accounts exist.
  if (!user || !(await deps.passwords.verify(password, user.passwordHash))) {
    return fail('unauthorized', 'Invalid email or password');
  }

  const now = deps.clock.now();
  const session: Session = {
    token: deps.tokens.next(),
    userId: user.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
  deps.sessions.insert(session);
  return ok({ token: session.token, expiresAt: session.expiresAt, user: toUserSummary(user) });
}
