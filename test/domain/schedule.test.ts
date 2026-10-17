import { describe, expect, it } from 'vitest';
import { createEvent } from '../../src/domain/commands/createEvent.js';
import { updateEvent } from '../../src/domain/commands/updateEvent.js';
import { deleteEvent } from '../../src/domain/commands/deleteEvent.js';
import { listEvents } from '../../src/domain/queries/listEvents.js';
import { getEvent } from '../../src/domain/queries/getEvent.js';
import { fakeDeps } from '../fakes/inMemory.js';
import { expectError, seedProject, unwrap } from '../fakes/fixtures.js';

const at = (h: number, day = 20) => `2026-10-${day}T${String(h).padStart(2, '0')}:00:00.000Z`;

describe('createEvent', () => {
  it('creates an event, normalising times to UTC ISO', async () => {
    const deps = fakeDeps();
    const { alice, project } = await seedProject(deps);
    const e = unwrap(createEvent(deps, { actorId: alice.id, projectId: project.id, title: 'Standup', startsAt: '2026-10-20T09:00:00+02:00', endsAt: '2026-10-20T09:15:00+02:00' }));
    expect(e).toMatchObject({ title: 'Standup', startsAt: '2026-10-20T07:00:00.000Z', endsAt: '2026-10-20T07:15:00.000Z', description: '' });
  });

  it('rejects bad times, reversed ranges and outsiders', async () => {
    const deps = fakeDeps();
    const { alice, mallory, project } = await seedProject(deps);
    expectError(createEvent(deps, { actorId: alice.id, projectId: project.id, title: 'x', startsAt: 'soon', endsAt: at(10) }), 'validation');
    const err = expectError(createEvent(deps, { actorId: alice.id, projectId: project.id, title: 'x', startsAt: at(10), endsAt: at(9) }), 'validation');
    expect(err.fields).toHaveProperty('endsAt');
    expectError(createEvent(deps, { actorId: mallory.id, projectId: project.id, title: 'x', startsAt: at(9), endsAt: at(10) }), 'forbidden');
  });
});

describe('updateEvent', () => {
  it('patches and re-checks the range against existing values', async () => {
    const deps = fakeDeps();
    const { alice, project } = await seedProject(deps);
    const e = unwrap(createEvent(deps, { actorId: alice.id, projectId: project.id, title: 'x', startsAt: at(9), endsAt: at(10) }));
    expect(unwrap(updateEvent(deps, { actorId: alice.id, eventId: e.id, title: 'y', endsAt: at(11) }))).toMatchObject({ title: 'y', startsAt: at(9), endsAt: at(11) });
    expectError(updateEvent(deps, { actorId: alice.id, eventId: e.id, startsAt: at(12) }), 'validation');
    expectError(updateEvent(deps, { actorId: alice.id, eventId: 'nope', title: 'z' }), 'not_found');
  });
});

describe('deleteEvent', () => {
  it('deletes an event', async () => {
    const deps = fakeDeps();
    const { alice, mallory, project } = await seedProject(deps);
    const e = unwrap(createEvent(deps, { actorId: alice.id, projectId: project.id, title: 'x', startsAt: at(9), endsAt: at(10) }));
    expectError(deleteEvent(deps, { actorId: mallory.id, eventId: e.id }), 'forbidden');
    unwrap(deleteEvent(deps, { actorId: alice.id, eventId: e.id }));
    expect(deps.store.events.size).toBe(0);
  });
});

describe('listEvents', () => {
  it('orders by start and filters by overlapping window', async () => {
    const deps = fakeDeps();
    const { alice, mallory, project } = await seedProject(deps);
    unwrap(createEvent(deps, { actorId: alice.id, projectId: project.id, title: 'late', startsAt: at(15), endsAt: at(16) }));
    unwrap(createEvent(deps, { actorId: alice.id, projectId: project.id, title: 'early', startsAt: at(8), endsAt: at(9) }));
    unwrap(createEvent(deps, { actorId: alice.id, projectId: project.id, title: 'next day', startsAt: at(8, 21), endsAt: at(9, 21) }));
    const all = unwrap(listEvents(deps, { actorId: alice.id, projectId: project.id }));
    expect(all.map((e) => e.title)).toEqual(['early', 'late', 'next day']);
    expect(all[0]?.createdBy?.name).toBe('Alice');
    const window = unwrap(listEvents(deps, { actorId: alice.id, projectId: project.id, from: at(8, 20), to: at(0, 21) }));
    expect(window.map((e) => e.title)).toEqual(['early', 'late']);
    expectError(listEvents(deps, { actorId: alice.id, projectId: project.id, from: 'garbage' }), 'validation');
    expectError(listEvents(deps, { actorId: mallory.id, projectId: project.id }), 'forbidden');
  });
});

describe('getEvent', () => {
  it('returns one event', async () => {
    const deps = fakeDeps();
    const { alice, mallory, project } = await seedProject(deps);
    const e = unwrap(createEvent(deps, { actorId: alice.id, projectId: project.id, title: 'x', startsAt: at(9), endsAt: at(10) }));
    expect(unwrap(getEvent(deps, { actorId: alice.id, eventId: e.id })).title).toBe('x');
    expectError(getEvent(deps, { actorId: mallory.id, eventId: e.id }), 'forbidden');
    expectError(getEvent(deps, { actorId: alice.id, eventId: 'nope' }), 'not_found');
  });
});
