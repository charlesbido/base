/**
 * Integration tests: the real domain handlers running against the real SQLite adapters.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCamp, type Camp } from '../../src/domain/index.js';
import { openDatabase, sqliteRepositories, type Db } from '../../src/adapters/sqlite/index.js';
import { BcryptPasswordHasher, CryptoTokenGenerator } from '../../src/adapters/system/index.js';
import { FakeClock, SequentialIds } from '../fakes/inMemory.js';
import { unwrap } from '../fakes/fixtures.js';

function sqliteCamp(db: Db, clock = new FakeClock()) {
  const camp = createCamp({
    ...sqliteRepositories(db),
    clock,
    ids: new SequentialIds('id'),
    tokens: new CryptoTokenGenerator(),
    passwords: new BcryptPasswordHasher(4),
  });
  return { camp, clock };
}

async function seed(camp: Camp) {
  const alice = unwrap(await camp.commands.registerUser({ email: 'alice@example.com', name: 'Alice', password: 'password123' }));
  const bob = unwrap(await camp.commands.registerUser({ email: 'bob@example.com', name: 'Bob', password: 'password123' }));
  const project = unwrap(camp.commands.createProject({ actorId: alice.id, name: 'Launch' }));
  unwrap(camp.commands.addProjectMember({ actorId: alice.id, projectId: project.id, email: 'bob@example.com' }));
  return { alice, bob, project };
}

describe('SQLite adapters', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('persists data across connections (file-backed database)', async () => {
    dir = mkdtempSync(join(tmpdir(), 'camp-'));
    const file = join(dir, 'camp.db');
    const first = openDatabase(file);
    const { camp } = sqliteCamp(first);
    const { alice, project } = await seed(camp);
    const list = unwrap(camp.commands.createTodoList({ actorId: alice.id, projectId: project.id, name: 'Tasks' }));
    unwrap(camp.commands.createTodo({ actorId: alice.id, listId: list.id, title: 'Persist me', dueDate: '2026-11-01' }));
    first.close();

    const second = openDatabase(file);
    const reopened = sqliteCamp(second).camp;
    const lists = unwrap(reopened.queries.listTodoLists({ actorId: alice.id, projectId: project.id }));
    expect(lists[0]?.todos[0]).toMatchObject({ title: 'Persist me', dueDate: '2026-11-01', done: false });
    // Real bcrypt round-trip.
    const session = unwrap(await reopened.commands.login({ email: 'alice@example.com', password: 'password123' }));
    expect(unwrap(reopened.queries.getCurrentUser({ token: session.token })).name).toBe('Alice');
    second.close();
  });

  it('runs a full to-do + comment flow with correct ordering and counts', async () => {
    const db = openDatabase(':memory:');
    const { camp, clock } = sqliteCamp(db);
    const { alice, bob, project } = await seed(camp);
    const list = unwrap(camp.commands.createTodoList({ actorId: alice.id, projectId: project.id, name: 'Tasks' }));
    const a = unwrap(camp.commands.createTodo({ actorId: alice.id, listId: list.id, title: 'a', assigneeId: bob.id }));
    const b = unwrap(camp.commands.createTodo({ actorId: alice.id, listId: list.id, title: 'b' }));
    clock.advance(1000);
    unwrap(camp.commands.setTodoCompletion({ actorId: bob.id, todoId: a.id, done: true }));
    unwrap(camp.commands.addComment({ actorId: bob.id, parentType: 'todo', parentId: b.id, body: 'first' }));
    unwrap(camp.commands.addComment({ actorId: alice.id, parentType: 'todo', parentId: b.id, body: 'second' }));

    const [view] = unwrap(camp.queries.listTodoLists({ actorId: bob.id, projectId: project.id }));
    expect(view?.todos.map((t) => [t.title, t.done, t.commentCount])).toEqual([['b', false, 2], ['a', true, 0]]);
    expect(view?.todos[1]?.assignee?.name).toBe('Bob');

    const detail = unwrap(camp.queries.getTodo({ actorId: alice.id, todoId: b.id }));
    expect(detail.comments.map((c) => c.body)).toEqual(['first', 'second']);

    unwrap(camp.commands.updateTodo({ actorId: alice.id, todoId: a.id, assigneeId: null }));
    expect(unwrap(camp.queries.getTodo({ actorId: alice.id, todoId: a.id })).assignee).toBeNull();
    db.close();
  });

  it('cascades deletes through foreign keys', async () => {
    const db = openDatabase(':memory:');
    const { camp } = sqliteCamp(db);
    const { alice, bob, project } = await seed(camp);
    const list = unwrap(camp.commands.createTodoList({ actorId: alice.id, projectId: project.id, name: 'Tasks' }));
    const todo = unwrap(camp.commands.createTodo({ actorId: alice.id, listId: list.id, title: 't' }));
    unwrap(camp.commands.addComment({ actorId: bob.id, parentType: 'todo', parentId: todo.id, body: 'c' }));
    const post = unwrap(camp.commands.createPost({ actorId: alice.id, projectId: project.id, title: 'p', body: 'b' }));
    unwrap(camp.commands.addComment({ actorId: bob.id, parentType: 'post', parentId: post.id, body: 'c' }));
    unwrap(camp.commands.createDoc({ actorId: alice.id, projectId: project.id, title: 'd' }));
    unwrap(camp.commands.createEvent({ actorId: alice.id, projectId: project.id, title: 'e', startsAt: '2026-11-01T09:00:00Z', endsAt: '2026-11-01T10:00:00Z' }));
    unwrap(camp.commands.postChatMessage({ actorId: bob.id, projectId: project.id, body: 'hi' }));

    const count = (table: string) => (db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get() as number);
    unwrap(camp.commands.deleteTodoList({ actorId: alice.id, listId: list.id }));
    expect([count('todos'), count('comments')]).toEqual([0, 1]);

    unwrap(camp.commands.deleteProject({ actorId: alice.id, projectId: project.id }));
    for (const table of ['projects', 'project_members', 'posts', 'comments', 'docs', 'events', 'chat_messages']) {
      expect(count(table), table).toBe(0);
    }
    db.close();
  });

  it('pages Campfire messages and filters events by window', async () => {
    const db = openDatabase(':memory:');
    const { camp, clock } = sqliteCamp(db);
    const { alice, bob, project } = await seed(camp);
    for (const body of ['one', 'two', 'three']) {
      unwrap(camp.commands.postChatMessage({ actorId: alice.id, projectId: project.id, body }));
    }
    // Same-millisecond messages keep insertion order.
    const all = unwrap(camp.queries.listChatMessages({ actorId: bob.id, projectId: project.id }));
    expect(all.messages.map((m) => m.body)).toEqual(['one', 'two', 'three']);
    const latest = unwrap(camp.queries.listChatMessages({ actorId: bob.id, projectId: project.id, limit: 2 }));
    expect(latest.messages.map((m) => m.body)).toEqual(['two', 'three']);
    clock.advance(1000);
    unwrap(camp.commands.postChatMessage({ actorId: bob.id, projectId: project.id, body: 'four' }));
    clock.advance(1000);
    const poll = unwrap(camp.queries.listChatMessages({ actorId: bob.id, projectId: project.id, since: clock.now().toISOString() }));
    expect(poll.messages).toEqual([]);

    for (const [title, start, end] of [['b', '2026-11-02T09:00:00Z', '2026-11-02T10:00:00Z'], ['a', '2026-11-01T09:00:00Z', '2026-11-01T10:00:00Z']] as const) {
      unwrap(camp.commands.createEvent({ actorId: alice.id, projectId: project.id, title, startsAt: start, endsAt: end }));
    }
    expect(unwrap(camp.queries.listEvents({ actorId: alice.id, projectId: project.id })).map((e) => e.title)).toEqual(['a', 'b']);
    expect(
      unwrap(camp.queries.listEvents({ actorId: alice.id, projectId: project.id, from: '2026-11-02T00:00:00Z' })).map((e) => e.title),
    ).toEqual(['b']);
    db.close();
  });

  it('creates a long-lived access token that getCurrentUser accepts, and persists only its hash', async () => {
    const db = openDatabase(':memory:');
    const { camp, clock } = sqliteCamp(db);
    const { alice } = await seed(camp);

    const created = unwrap(camp.commands.createAccessToken({ actorId: alice.id, name: 'My laptop' }));
    expect(unwrap(camp.queries.getCurrentUser({ token: created.token })).id).toBe(alice.id);

    const stored = db.prepare('SELECT token_hash FROM access_tokens WHERE id = ?').get(created.id) as { token_hash: string };
    expect(stored.token_hash).not.toBe(created.token);

    clock.advance(1000 * 60 * 60 * 24 * 365 * 10); // 10 years — long past any Session's TTL
    expect(unwrap(camp.queries.getCurrentUser({ token: created.token })).id).toBe(alice.id);

    unwrap(camp.commands.revokeAccessToken({ actorId: alice.id, tokenId: created.id }));
    expect(camp.queries.getCurrentUser({ token: created.token }).ok).toBe(false);
    db.close();
  });

  it('enforces unique emails at the database level too', async () => {
    const db = openDatabase(':memory:');
    const repos = sqliteRepositories(db);
    const user = { id: 'u1', email: 'x@example.com', name: 'X', passwordHash: 'h', createdAt: '2026-01-01T00:00:00.000Z' };
    repos.users.insert(user);
    expect(() => repos.users.insert({ ...user, id: 'u2' })).toThrow(/UNIQUE/);
    db.close();
  });
});
