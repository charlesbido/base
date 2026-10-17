import { describe, expect, it } from 'vitest';
import { createProject } from '../../src/domain/commands/createProject.js';
import { updateProject } from '../../src/domain/commands/updateProject.js';
import { deleteProject } from '../../src/domain/commands/deleteProject.js';
import { addProjectMember } from '../../src/domain/commands/addProjectMember.js';
import { removeProjectMember } from '../../src/domain/commands/removeProjectMember.js';
import { createTodo } from '../../src/domain/commands/createTodo.js';
import { createPost } from '../../src/domain/commands/createPost.js';
import { createDoc } from '../../src/domain/commands/createDoc.js';
import { createEvent } from '../../src/domain/commands/createEvent.js';
import { setTodoCompletion } from '../../src/domain/commands/setTodoCompletion.js';
import { postChatMessage } from '../../src/domain/commands/postChatMessage.js';
import { listProjects } from '../../src/domain/queries/listProjects.js';
import { getProject } from '../../src/domain/queries/getProject.js';
import { fakeDeps } from '../fakes/inMemory.js';
import { expectError, seedProject, seedUser, unwrap } from '../fakes/fixtures.js';

describe('createProject', () => {
  it('creates a project with the creator as the only member', async () => {
    const deps = fakeDeps();
    const ada = await seedUser(deps, 'Ada');
    const p = unwrap(createProject(deps, { actorId: ada.id, name: '  Website  ' }));
    expect(p).toMatchObject({ name: 'Website', description: '', createdBy: ada.id, createdAt: '2026-10-17T12:00:00.000Z' });
    expect(deps.projects.listMemberIds(p.id)).toEqual([ada.id]);
  });

  it('requires a name', async () => {
    const deps = fakeDeps();
    const ada = await seedUser(deps, 'Ada');
    expectError(createProject(deps, { actorId: ada.id, name: '   ' }), 'validation');
  });
});

describe('updateProject', () => {
  it('patches only the provided fields and bumps updatedAt', async () => {
    const deps = fakeDeps();
    const { alice, project } = await seedProject(deps);
    deps.clock.advance(1000);
    const p = unwrap(updateProject(deps, { actorId: alice.id, projectId: project.id, description: 'New' }));
    expect(p.name).toBe('Launch');
    expect(p.description).toBe('New');
    expect(p.updatedAt).toBe('2026-10-17T12:00:01.000Z');
  });

  it('forbids non-members and 404s unknown projects', async () => {
    const deps = fakeDeps();
    const { mallory, project } = await seedProject(deps);
    expectError(updateProject(deps, { actorId: mallory.id, projectId: project.id, name: 'Mine' }), 'forbidden');
    expectError(updateProject(deps, { actorId: mallory.id, projectId: 'nope', name: 'x' }), 'not_found');
  });
});

describe('deleteProject', () => {
  it('lets only the creator delete, cascading content', async () => {
    const deps = fakeDeps();
    const { alice, bob, project, list } = await seedProject(deps);
    unwrap(createTodo(deps, { actorId: bob.id, listId: list.id, title: 'x' }));
    expectError(deleteProject(deps, { actorId: bob.id, projectId: project.id }), 'forbidden');
    unwrap(deleteProject(deps, { actorId: alice.id, projectId: project.id }));
    expect(deps.store.projects.size).toBe(0);
    expect(deps.store.todos.size).toBe(0);
    expect(deps.store.lists.size).toBe(0);
  });
});

describe('addProjectMember', () => {
  it('adds by email or id, idempotently', async () => {
    const deps = fakeDeps();
    const { alice, mallory, project } = await seedProject(deps);
    const added = unwrap(addProjectMember(deps, { actorId: alice.id, projectId: project.id, email: 'MALLORY@example.com' }));
    expect(added.id).toBe(mallory.id);
    unwrap(addProjectMember(deps, { actorId: alice.id, projectId: project.id, userId: mallory.id }));
    expect(deps.projects.listMemberIds(project.id)).toHaveLength(3);
  });

  it('rejects unknown users, missing identifiers, and non-member actors', async () => {
    const deps = fakeDeps();
    const { alice, mallory, project } = await seedProject(deps);
    expectError(addProjectMember(deps, { actorId: alice.id, projectId: project.id, email: 'ghost@example.com' }), 'not_found');
    expectError(addProjectMember(deps, { actorId: alice.id, projectId: project.id }), 'validation');
    expectError(addProjectMember(deps, { actorId: mallory.id, projectId: project.id, userId: mallory.id }), 'forbidden');
  });
});

describe('removeProjectMember', () => {
  it('removes a member but never the creator', async () => {
    const deps = fakeDeps();
    const { alice, bob, project } = await seedProject(deps);
    expectError(removeProjectMember(deps, { actorId: bob.id, projectId: project.id, userId: alice.id }), 'conflict');
    unwrap(removeProjectMember(deps, { actorId: bob.id, projectId: project.id, userId: bob.id }));
    expect(deps.projects.isMember(project.id, bob.id)).toBe(false);
    expectError(removeProjectMember(deps, { actorId: alice.id, projectId: project.id, userId: bob.id }), 'not_found');
  });
});

describe('listProjects', () => {
  it("returns only the actor's projects, most recently updated first", async () => {
    const deps = fakeDeps();
    const { alice, bob, mallory, project } = await seedProject(deps);
    deps.clock.advance(1000);
    const second = unwrap(createProject(deps, { actorId: alice.id, name: 'Second' }));
    const cards = unwrap(listProjects(deps, { actorId: alice.id }));
    expect(cards.map((c) => c.id)).toEqual([second.id, project.id]);
    expect(cards[1]?.memberCount).toBe(2);
    expect(unwrap(listProjects(deps, { actorId: bob.id }))).toHaveLength(1);
    expect(unwrap(listProjects(deps, { actorId: mallory.id }))).toEqual([]);
  });
});

describe('getProject', () => {
  it('returns members and per-tool stats', async () => {
    const deps = fakeDeps();
    const { alice, bob, mallory, project, list } = await seedProject(deps);
    const t1 = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 'a' }));
    unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 'b' }));
    unwrap(setTodoCompletion(deps, { actorId: alice.id, todoId: t1.id, done: true }));
    unwrap(createPost(deps, { actorId: alice.id, projectId: project.id, title: 'Hi', body: 'There' }));
    unwrap(createDoc(deps, { actorId: alice.id, projectId: project.id, title: 'Spec' }));
    unwrap(createEvent(deps, { actorId: alice.id, projectId: project.id, title: 'Past', startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-01T01:00:00Z' }));
    unwrap(createEvent(deps, { actorId: alice.id, projectId: project.id, title: 'Future', startsAt: '2026-12-01T00:00:00Z', endsAt: '2026-12-01T01:00:00Z' }));
    unwrap(postChatMessage(deps, { actorId: alice.id, projectId: project.id, body: 'yo' }));

    const detail = unwrap(getProject(deps, { actorId: bob.id, projectId: project.id }));
    expect(detail.members.map((m) => m.name)).toEqual(['Alice', 'Bob']);
    expect(detail.createdBy?.name).toBe('Alice');
    expect(detail.stats).toEqual({ openTodos: 1, completedTodos: 1, posts: 1, docs: 1, upcomingEvents: 1 });
    expectError(getProject(deps, { actorId: mallory.id, projectId: project.id }), 'forbidden');
  });
});
