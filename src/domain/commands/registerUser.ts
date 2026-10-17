import type { CampDeps } from '../../ports/index.js';
import { fail, ok, type Result } from '../result.js';
import { nowIso, toUserSummary } from '../shared.js';
import type { User, UserSummary } from '../types.js';
import { Validator } from '../validation.js';

export interface RegisterUserInput {
  email: string;
  name: string;
  password: string;
}

export type RegisterUserDeps = Pick<CampDeps, 'users' | 'passwords' | 'ids' | 'clock'>;

export async function registerUser(
  deps: RegisterUserDeps,
  input: RegisterUserInput,
): Promise<Result<UserSummary>> {
  const v = new Validator();
  const email = v.email(input.email);
  const name = v.requiredString(input.name, 'name', 100);
  const password = v.password(input.password);
  const invalid = v.failure();
  if (invalid) return invalid;

  if (deps.users.findByEmail(email)) {
    return fail('conflict', 'An account with that email already exists', { email: 'already registered' });
  }

  const user: User = {
    id: deps.ids.next(),
    email,
    name,
    passwordHash: await deps.passwords.hash(password),
    createdAt: nowIso(deps.clock),
  };
  deps.users.insert(user);
  return ok(toUserSummary(user));
}
