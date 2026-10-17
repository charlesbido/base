import { describe, expect, it } from 'vitest';
import { addComment } from '../../src/domain/commands/addComment.js';
import { deleteComment } from '../../src/domain/commands/deleteComment.js';
import { createTodo } from '../../src/domain/commands/createTodo.js';
import { createPost } from '../../src/domain/commands/createPost.js';
import { fakeDeps } from '../fakes/inMemory.js';
import { expectError, seedProject, unwrap } from '../fakes/fixtures.js';

describe('addComment', () => {
  it('comments on to-dos and posts, recording the project', async () => {
    const deps = fakeDeps();
    const { alice, bob, project, list } = await seedProject(deps);
    const todo = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 't' }));
    const post = unwrap(createPost(deps, { actorId: alice.id, projectId: project.id, title: 'p', body: 'b' }));
    const c1 = unwrap(addComment(deps, { actorId: bob.id, parentType: 'todo', parentId: todo.id, body: ' nice ' }));
    const c2 = unwrap(addComment(deps, { actorId: bob.id, parentType: 'post', parentId: post.id, body: 'agreed' }));
    expect(c1).toMatchObject({ projectId: project.id, parentType: 'todo', parentId: todo.id, body: 'nice', authorId: bob.id });
    expect(c2).toMatchObject({ parentType: 'post', parentId: post.id });
  });

  it('rejects empty bodies, unknown parents, bad parent types and outsiders', async () => {
    const deps = fakeDeps();
    const { alice, mallory, list } = await seedProject(deps);
    const todo = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 't' }));
    expectError(addComment(deps, { actorId: alice.id, parentType: 'todo', parentId: todo.id, body: '' }), 'validation');
    expectError(addComment(deps, { actorId: alice.id, parentType: 'todo', parentId: 'nope', body: 'x' }), 'not_found');
    expectError(addComment(deps, { actorId: alice.id, parentType: 'post', parentId: 'nope', body: 'x' }), 'not_found');
    expectError(addComment(deps, { actorId: alice.id, parentType: 'doc' as 'todo', parentId: todo.id, body: 'x' }), 'validation');
    expectError(addComment(deps, { actorId: mallory.id, parentType: 'todo', parentId: todo.id, body: 'x' }), 'forbidden');
  });
});

describe('deleteComment', () => {
  it('only lets the author delete', async () => {
    const deps = fakeDeps();
    const { alice, bob, list } = await seedProject(deps);
    const todo = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 't' }));
    const c = unwrap(addComment(deps, { actorId: bob.id, parentType: 'todo', parentId: todo.id, body: 'mine' }));
    expectError(deleteComment(deps, { actorId: alice.id, commentId: c.id }), 'forbidden');
    unwrap(deleteComment(deps, { actorId: bob.id, commentId: c.id }));
    expectError(deleteComment(deps, { actorId: bob.id, commentId: c.id }), 'not_found');
  });
});
