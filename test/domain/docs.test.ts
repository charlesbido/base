import { describe, expect, it } from 'vitest';
import { createDoc } from '../../src/domain/commands/createDoc.js';
import { updateDoc } from '../../src/domain/commands/updateDoc.js';
import { deleteDoc } from '../../src/domain/commands/deleteDoc.js';
import { listDocs } from '../../src/domain/queries/listDocs.js';
import { getDoc } from '../../src/domain/queries/getDoc.js';
import { fakeDeps } from '../fakes/inMemory.js';
import { expectError, seedProject, unwrap } from '../fakes/fixtures.js';

describe('createDoc', () => {
  it('creates a doc with an optional body', async () => {
    const deps = fakeDeps();
    const { alice, mallory, project } = await seedProject(deps);
    const doc = unwrap(createDoc(deps, { actorId: alice.id, projectId: project.id, title: 'Spec' }));
    expect(doc).toMatchObject({ title: 'Spec', body: '', authorId: alice.id, updatedBy: alice.id });
    expectError(createDoc(deps, { actorId: alice.id, projectId: project.id, title: '' }), 'validation');
    expectError(createDoc(deps, { actorId: mallory.id, projectId: project.id, title: 'x' }), 'forbidden');
  });
});

describe('updateDoc', () => {
  it('lets any member edit and records who', async () => {
    const deps = fakeDeps();
    const { alice, bob, mallory, project } = await seedProject(deps);
    const doc = unwrap(createDoc(deps, { actorId: alice.id, projectId: project.id, title: 'Spec', body: 'v1' }));
    const edited = unwrap(updateDoc(deps, { actorId: bob.id, docId: doc.id, body: 'v2' }));
    expect(edited).toMatchObject({ title: 'Spec', body: 'v2', authorId: alice.id, updatedBy: bob.id });
    expectError(updateDoc(deps, { actorId: mallory.id, docId: doc.id, body: 'x' }), 'forbidden');
    expectError(updateDoc(deps, { actorId: bob.id, docId: 'nope', body: 'x' }), 'not_found');
  });
});

describe('deleteDoc', () => {
  it('deletes a doc', async () => {
    const deps = fakeDeps();
    const { alice, mallory, project } = await seedProject(deps);
    const doc = unwrap(createDoc(deps, { actorId: alice.id, projectId: project.id, title: 'Spec' }));
    expectError(deleteDoc(deps, { actorId: mallory.id, docId: doc.id }), 'forbidden');
    unwrap(deleteDoc(deps, { actorId: alice.id, docId: doc.id }));
    expect(deps.store.docs.size).toBe(0);
  });
});

describe('listDocs', () => {
  it('lists most recently updated first', async () => {
    const deps = fakeDeps();
    const { alice, bob, mallory, project } = await seedProject(deps);
    const a = unwrap(createDoc(deps, { actorId: alice.id, projectId: project.id, title: 'A' }));
    deps.clock.advance(1);
    unwrap(createDoc(deps, { actorId: alice.id, projectId: project.id, title: 'B' }));
    deps.clock.advance(1);
    unwrap(updateDoc(deps, { actorId: bob.id, docId: a.id, body: 'touched' }));
    const docs = unwrap(listDocs(deps, { actorId: alice.id, projectId: project.id }));
    expect(docs.map((d) => d.title)).toEqual(['A', 'B']);
    expect(docs[0]).toMatchObject({ excerpt: 'touched', updatedBy: { name: 'Bob' } });
    expectError(listDocs(deps, { actorId: mallory.id, projectId: project.id }), 'forbidden');
  });
});

describe('getDoc', () => {
  it('returns the full doc', async () => {
    const deps = fakeDeps();
    const { alice, mallory, project } = await seedProject(deps);
    const doc = unwrap(createDoc(deps, { actorId: alice.id, projectId: project.id, title: 'Spec', body: 'Body' }));
    expect(unwrap(getDoc(deps, { actorId: alice.id, docId: doc.id }))).toMatchObject({ body: 'Body', author: { name: 'Alice' } });
    expectError(getDoc(deps, { actorId: mallory.id, docId: doc.id }), 'forbidden');
  });
});
