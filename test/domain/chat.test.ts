import { describe, expect, it } from 'vitest';
import { postChatMessage } from '../../src/domain/commands/postChatMessage.js';
import { listChatMessages } from '../../src/domain/queries/listChatMessages.js';
import { fakeDeps } from '../fakes/inMemory.js';
import { expectError, seedProject, unwrap } from '../fakes/fixtures.js';

describe('postChatMessage', () => {
  it('posts a line to the Campfire', async () => {
    const deps = fakeDeps();
    const { bob, mallory, project } = await seedProject(deps);
    const m = unwrap(postChatMessage(deps, { actorId: bob.id, projectId: project.id, body: ' hello ' }));
    expect(m).toMatchObject({ projectId: project.id, authorId: bob.id, body: 'hello', createdAt: '2026-10-17T12:00:00.000Z' });
    expectError(postChatMessage(deps, { actorId: bob.id, projectId: project.id, body: '  ' }), 'validation');
    expectError(postChatMessage(deps, { actorId: mallory.id, projectId: project.id, body: 'hi' }), 'forbidden');
  });
});

describe('listChatMessages', () => {
  it('returns the latest messages and a cursor for polling', async () => {
    const deps = fakeDeps();
    const { alice, bob, mallory, project } = await seedProject(deps);
    for (const body of ['one', 'two', 'three']) {
      unwrap(postChatMessage(deps, { actorId: alice.id, projectId: project.id, body }));
      deps.clock.advance(1000);
    }
    const initial = unwrap(listChatMessages(deps, { actorId: bob.id, projectId: project.id, limit: 2 }));
    expect(initial.messages.map((m) => m.body)).toEqual(['two', 'three']);
    expect(initial.messages[0]?.author?.name).toBe('Alice');
    expect(initial.cursor).toBe('2026-10-17T12:00:02.000Z');

    unwrap(postChatMessage(deps, { actorId: bob.id, projectId: project.id, body: 'four' }));
    const poll = unwrap(listChatMessages(deps, { actorId: bob.id, projectId: project.id, since: initial.cursor! }));
    // Inclusive bound: the last-seen message comes back too; the client de-dupes by id.
    expect(poll.messages.map((m) => m.body)).toEqual(['three', 'four']);
    expect(poll.cursor).toBe('2026-10-17T12:00:03.000Z');

    deps.clock.advance(1000);
    const empty = unwrap(listChatMessages(deps, { actorId: bob.id, projectId: project.id, since: '2026-10-17T13:00:00.000Z' }));
    expect(empty).toEqual({ messages: [], cursor: '2026-10-17T13:00:00.000Z' });

    expectError(listChatMessages(deps, { actorId: bob.id, projectId: project.id, limit: 0 }), 'validation');
    expectError(listChatMessages(deps, { actorId: mallory.id, projectId: project.id }), 'forbidden');
  });
});
