/** Seed helpers for domain tests. They go through the real command handlers. */
import { createProject } from '../../src/domain/commands/createProject.js';
import { createTodoList } from '../../src/domain/commands/createTodoList.js';
import { registerUser } from '../../src/domain/commands/registerUser.js';
import { addProjectMember } from '../../src/domain/commands/addProjectMember.js';
import type { Result } from '../../src/domain/result.js';
import type { FakeDeps } from './inMemory.js';

export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`Expected ok, got ${r.error.code}: ${r.error.message}`);
  return r.value;
}

export function expectError<T>(r: Result<T>, code: string) {
  if (r.ok) throw new Error(`Expected ${code} error, got ok`);
  if (r.error.code !== code) throw new Error(`Expected ${code}, got ${r.error.code}: ${r.error.message}`);
  return r.error;
}

export async function seedUser(deps: FakeDeps, name: string) {
  const email = `${name.toLowerCase()}@example.com`;
  return unwrap(await registerUser(deps, { email, name, password: 'password123' }));
}

/** Alice owns a project; Bob is a member; Mallory is a registered outsider. */
export async function seedProject(deps: FakeDeps) {
  const alice = await seedUser(deps, 'Alice');
  const bob = await seedUser(deps, 'Bob');
  const mallory = await seedUser(deps, 'Mallory');
  const project = unwrap(createProject(deps, { actorId: alice.id, name: 'Launch', description: 'Ship it' }));
  unwrap(addProjectMember(deps, { actorId: alice.id, projectId: project.id, userId: bob.id }));
  const list = unwrap(createTodoList(deps, { actorId: alice.id, projectId: project.id, name: 'Tasks' }));
  return { alice, bob, mallory, project, list };
}
