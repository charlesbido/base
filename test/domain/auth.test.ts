import { describe, expect, it } from 'vitest';
import { registerUser } from '../../src/domain/commands/registerUser.js';
import { login, SESSION_TTL_MS } from '../../src/domain/commands/login.js';
import { logout } from '../../src/domain/commands/logout.js';
import { createAccessToken } from '../../src/domain/commands/createAccessToken.js';
import { revokeAccessToken } from '../../src/domain/commands/revokeAccessToken.js';
import { getCurrentUser } from '../../src/domain/queries/getCurrentUser.js';
import { listAccessTokens } from '../../src/domain/queries/listAccessTokens.js';
import { listUsers } from '../../src/domain/queries/listUsers.js';
import { fakeDeps } from '../fakes/inMemory.js';
import { expectError, seedUser, unwrap } from '../fakes/fixtures.js';

describe('registerUser', () => {
  it('creates a user with a hashed password and normalised email', async () => {
    const deps = fakeDeps();
    const user = unwrap(await registerUser(deps, { email: ' Ada@Example.COM ', name: ' Ada ', password: 'correct horse' }));
    expect(user).toEqual({ id: 'id-1', email: 'ada@example.com', name: 'Ada' });
    expect(user).not.toHaveProperty('passwordHash');
    expect(deps.store.users.get('id-1')?.passwordHash).toBe('hashed:correct horse');
  });

  it('rejects invalid input with per-field errors', async () => {
    const deps = fakeDeps();
    const err = expectError(await registerUser(deps, { email: 'nope', name: '', password: 'short' }), 'validation');
    expect(Object.keys(err.fields ?? {}).sort()).toEqual(['email', 'name', 'password']);
  });

  it('rejects a duplicate email', async () => {
    const deps = fakeDeps();
    await seedUser(deps, 'Ada');
    expectError(await registerUser(deps, { email: 'ADA@example.com', name: 'Other', password: 'password123' }), 'conflict');
  });
});

describe('login', () => {
  it('opens a session that expires after the TTL', async () => {
    const deps = fakeDeps();
    const ada = await seedUser(deps, 'Ada');
    const session = unwrap(await login(deps, { email: 'ada@example.com', password: 'password123' }));
    expect(session.user).toEqual(ada);
    expect(session.token).toBe('token-1');
    expect(Date.parse(session.expiresAt) - deps.clock.now().getTime()).toBe(SESSION_TTL_MS);
    expect(deps.store.sessions.has('token-1')).toBe(true);
  });

  it('gives the same error for unknown email and wrong password', async () => {
    const deps = fakeDeps();
    await seedUser(deps, 'Ada');
    const a = expectError(await login(deps, { email: 'ada@example.com', password: 'wrong-pass' }), 'unauthorized');
    const b = expectError(await login(deps, { email: 'who@example.com', password: 'password123' }), 'unauthorized');
    expect(a.message).toBe(b.message);
  });
});

describe('logout', () => {
  it('deletes the session and is idempotent', async () => {
    const deps = fakeDeps();
    await seedUser(deps, 'Ada');
    const { token } = unwrap(await login(deps, { email: 'ada@example.com', password: 'password123' }));
    unwrap(logout(deps, { token }));
    expect(deps.store.sessions.size).toBe(0);
    unwrap(logout(deps, { token }));
  });
});

describe('getCurrentUser', () => {
  it('resolves a valid token to its user', async () => {
    const deps = fakeDeps();
    const ada = await seedUser(deps, 'Ada');
    const { token } = unwrap(await login(deps, { email: 'ada@example.com', password: 'password123' }));
    expect(unwrap(getCurrentUser(deps, { token }))).toEqual(ada);
  });

  it('rejects unknown, empty, and expired tokens', async () => {
    const deps = fakeDeps();
    await seedUser(deps, 'Ada');
    const { token } = unwrap(await login(deps, { email: 'ada@example.com', password: 'password123' }));
    expectError(getCurrentUser(deps, { token: 'bogus' }), 'unauthorized');
    expectError(getCurrentUser(deps, { token: '' }), 'unauthorized');
    deps.clock.advance(SESSION_TTL_MS + 1);
    expectError(getCurrentUser(deps, { token }), 'unauthorized');
  });
});

describe('createAccessToken', () => {
  it('mints a token that getCurrentUser resolves, and never expires by default', async () => {
    const deps = fakeDeps();
    const ada = await seedUser(deps, 'Ada');
    const created = unwrap(createAccessToken(deps, { actorId: ada.id, name: 'My laptop' }));
    expect(created.token).toBe('token-1');
    expect(created.expiresAt).toBeNull();
    expect(unwrap(getCurrentUser(deps, { token: created.token }))).toEqual(ada);

    deps.clock.advance(SESSION_TTL_MS * 100); // long past a session's TTL
    expect(unwrap(getCurrentUser(deps, { token: created.token }))).toEqual(ada);
  });

  it('honours an explicit expiry', async () => {
    const deps = fakeDeps();
    const ada = await seedUser(deps, 'Ada');
    const created = unwrap(createAccessToken(deps, { actorId: ada.id, name: 'CI bot', expiresInDays: 1 }));
    expect(unwrap(getCurrentUser(deps, { token: created.token }))).toEqual(ada);
    deps.clock.advance(2 * 24 * 60 * 60 * 1000);
    expectError(getCurrentUser(deps, { token: created.token }), 'unauthorized');
  });

  it('rejects a blank name and an out-of-range expiry', () => {
    const deps = fakeDeps();
    const err1 = expectError(createAccessToken(deps, { actorId: 'id-1', name: '' }), 'validation');
    expect(err1.fields).toHaveProperty('name');
    const err2 = expectError(createAccessToken(deps, { actorId: 'id-1', name: 'x', expiresInDays: -1 }), 'validation');
    expect(err2.fields).toHaveProperty('expiresInDays');
  });
});

describe('revokeAccessToken', () => {
  it('revokes immediately and is idempotent, but only for the owner', async () => {
    const deps = fakeDeps();
    const ada = await seedUser(deps, 'Ada');
    const bob = await seedUser(deps, 'Bob');
    const created = unwrap(createAccessToken(deps, { actorId: ada.id, name: 'My laptop' }));

    expectError(revokeAccessToken(deps, { actorId: bob.id, tokenId: created.id }), 'forbidden');
    unwrap(revokeAccessToken(deps, { actorId: ada.id, tokenId: created.id }));
    expectError(getCurrentUser(deps, { token: created.token }), 'unauthorized');
    unwrap(revokeAccessToken(deps, { actorId: ada.id, tokenId: created.id })); // idempotent
    expectError(revokeAccessToken(deps, { actorId: ada.id, tokenId: 'bogus' }), 'not_found');
  });
});

describe('listAccessTokens', () => {
  it("lists only the caller's tokens, newest first, without the raw token or hash", async () => {
    const deps = fakeDeps();
    const ada = await seedUser(deps, 'Ada');
    const bob = await seedUser(deps, 'Bob');
    const first = unwrap(createAccessToken(deps, { actorId: ada.id, name: 'First' }));
    deps.clock.advance(1000);
    const second = unwrap(createAccessToken(deps, { actorId: ada.id, name: 'Second' }));
    unwrap(createAccessToken(deps, { actorId: bob.id, name: "Bob's token" }));
    unwrap(revokeAccessToken(deps, { actorId: ada.id, tokenId: first.id }));

    const list = unwrap(listAccessTokens(deps, { actorId: ada.id }));
    expect(list).toEqual([
      { id: second.id, name: 'Second', createdAt: second.createdAt, expiresAt: null, revoked: false },
      { id: first.id, name: 'First', createdAt: first.createdAt, expiresAt: null, revoked: true },
    ]);
  });
});

describe('listUsers', () => {
  it('lists everyone by name without password hashes', async () => {
    const deps = fakeDeps();
    const zed = await seedUser(deps, 'Zed');
    const ada = await seedUser(deps, 'Ada');
    expect(unwrap(listUsers(deps, { actorId: zed.id }))).toEqual([ada, zed]);
  });
});
