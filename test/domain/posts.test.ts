import { describe, expect, it } from 'vitest';
import { createPost } from '../../src/domain/commands/createPost.js';
import { updatePost } from '../../src/domain/commands/updatePost.js';
import { deletePost } from '../../src/domain/commands/deletePost.js';
import { addComment } from '../../src/domain/commands/addComment.js';
import { listPosts } from '../../src/domain/queries/listPosts.js';
import { getPost } from '../../src/domain/queries/getPost.js';
import { fakeDeps } from '../fakes/inMemory.js';
import { expectError, seedProject, unwrap } from '../fakes/fixtures.js';

describe('createPost', () => {
  it('creates a post; title and body required', async () => {
    const deps = fakeDeps();
    const { alice, mallory, project } = await seedProject(deps);
    const post = unwrap(createPost(deps, { actorId: alice.id, projectId: project.id, title: 'Kickoff', body: '**Welcome**' }));
    expect(post).toMatchObject({ title: 'Kickoff', body: '**Welcome**', authorId: alice.id });
    expectError(createPost(deps, { actorId: alice.id, projectId: project.id, title: 'x', body: '' }), 'validation');
    expectError(createPost(deps, { actorId: mallory.id, projectId: project.id, title: 'x', body: 'y' }), 'forbidden');
  });
});

describe('updatePost', () => {
  it('lets the author edit', async () => {
    const deps = fakeDeps();
    const { alice, bob, project } = await seedProject(deps);
    const post = unwrap(createPost(deps, { actorId: alice.id, projectId: project.id, title: 'A', body: 'B' }));
    deps.clock.advance(1000);
    const edited = unwrap(updatePost(deps, { actorId: alice.id, postId: post.id, body: 'C' }));
    expect(edited).toMatchObject({ title: 'A', body: 'C', updatedAt: '2026-10-17T12:00:01.000Z' });
    expectError(updatePost(deps, { actorId: bob.id, postId: post.id, body: 'hijack' }), 'forbidden');
    expectError(updatePost(deps, { actorId: alice.id, postId: post.id, title: '' }), 'validation');
  });
});

describe('deletePost', () => {
  it('lets the author delete, removing comments', async () => {
    const deps = fakeDeps();
    const { alice, bob, project } = await seedProject(deps);
    const post = unwrap(createPost(deps, { actorId: alice.id, projectId: project.id, title: 'A', body: 'B' }));
    unwrap(addComment(deps, { actorId: bob.id, parentType: 'post', parentId: post.id, body: 'c' }));
    expectError(deletePost(deps, { actorId: bob.id, postId: post.id }), 'forbidden');
    unwrap(deletePost(deps, { actorId: alice.id, postId: post.id }));
    expect(deps.store.posts.size).toBe(0);
    expect(deps.store.comments.size).toBe(0);
  });
});

describe('listPosts', () => {
  it('lists newest first with excerpt, author and comment count', async () => {
    const deps = fakeDeps();
    const { alice, bob, mallory, project } = await seedProject(deps);
    const old = unwrap(createPost(deps, { actorId: alice.id, projectId: project.id, title: 'Old', body: 'x'.repeat(500) }));
    deps.clock.advance(1000);
    unwrap(createPost(deps, { actorId: bob.id, projectId: project.id, title: 'New', body: 'line one\n\nline   two' }));
    unwrap(addComment(deps, { actorId: bob.id, parentType: 'post', parentId: old.id, body: 'c' }));
    const posts = unwrap(listPosts(deps, { actorId: alice.id, projectId: project.id }));
    expect(posts.map((p) => p.title)).toEqual(['New', 'Old']);
    expect(posts[0]).toMatchObject({ excerpt: 'line one line two', author: { name: 'Bob' }, commentCount: 0 });
    expect(posts[1]?.excerpt.length).toBe(160);
    expect(posts[1]?.commentCount).toBe(1);
    expectError(listPosts(deps, { actorId: mallory.id, projectId: project.id }), 'forbidden');
  });
});

describe('getPost', () => {
  it('returns the full post with comments', async () => {
    const deps = fakeDeps();
    const { alice, bob, mallory, project } = await seedProject(deps);
    const post = unwrap(createPost(deps, { actorId: alice.id, projectId: project.id, title: 'T', body: 'Body' }));
    unwrap(addComment(deps, { actorId: bob.id, parentType: 'post', parentId: post.id, body: 'Reply' }));
    const detail = unwrap(getPost(deps, { actorId: bob.id, postId: post.id }));
    expect(detail).toMatchObject({ title: 'T', body: 'Body', author: { name: 'Alice' } });
    expect(detail.comments.map((c) => c.body)).toEqual(['Reply']);
    expectError(getPost(deps, { actorId: mallory.id, postId: post.id }), 'forbidden');
    expectError(getPost(deps, { actorId: bob.id, postId: 'nope' }), 'not_found');
  });
});
