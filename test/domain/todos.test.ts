import { describe, expect, it } from 'vitest';
import { createTodoList } from '../../src/domain/commands/createTodoList.js';
import { updateTodoList } from '../../src/domain/commands/updateTodoList.js';
import { deleteTodoList } from '../../src/domain/commands/deleteTodoList.js';
import { createTodo } from '../../src/domain/commands/createTodo.js';
import { updateTodo } from '../../src/domain/commands/updateTodo.js';
import { setTodoCompletion } from '../../src/domain/commands/setTodoCompletion.js';
import { deleteTodo } from '../../src/domain/commands/deleteTodo.js';
import { addComment } from '../../src/domain/commands/addComment.js';
import { listTodoLists } from '../../src/domain/queries/listTodoLists.js';
import { getTodo } from '../../src/domain/queries/getTodo.js';
import { fakeDeps } from '../fakes/inMemory.js';
import { expectError, seedProject, unwrap } from '../fakes/fixtures.js';

describe('createTodoList', () => {
  it('creates a list in a project the actor belongs to', async () => {
    const deps = fakeDeps();
    const { bob, mallory, project } = await seedProject(deps);
    const list = unwrap(createTodoList(deps, { actorId: bob.id, projectId: project.id, name: 'Bugs', description: 'all of them' }));
    expect(list).toMatchObject({ projectId: project.id, name: 'Bugs', description: 'all of them', createdBy: bob.id });
    expectError(createTodoList(deps, { actorId: mallory.id, projectId: project.id, name: 'x' }), 'forbidden');
    expectError(createTodoList(deps, { actorId: bob.id, projectId: project.id, name: '' }), 'validation');
  });
});

describe('updateTodoList', () => {
  it('renames a list', async () => {
    const deps = fakeDeps();
    const { alice, mallory, list } = await seedProject(deps);
    expect(unwrap(updateTodoList(deps, { actorId: alice.id, listId: list.id, name: 'Renamed' })).name).toBe('Renamed');
    expectError(updateTodoList(deps, { actorId: mallory.id, listId: list.id, name: 'x' }), 'forbidden');
    expectError(updateTodoList(deps, { actorId: alice.id, listId: 'nope', name: 'x' }), 'not_found');
  });
});

describe('deleteTodoList', () => {
  it('deletes the list with its to-dos and their comments', async () => {
    const deps = fakeDeps();
    const { alice, list } = await seedProject(deps);
    const todo = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 't' }));
    unwrap(addComment(deps, { actorId: alice.id, parentType: 'todo', parentId: todo.id, body: 'c' }));
    unwrap(deleteTodoList(deps, { actorId: alice.id, listId: list.id }));
    expect(deps.store.lists.size).toBe(0);
    expect(deps.store.todos.size).toBe(0);
    expect(deps.store.comments.size).toBe(0);
  });
});

describe('createTodo', () => {
  it('creates an open to-do with optional assignee and due date', async () => {
    const deps = fakeDeps();
    const { alice, bob, list, project } = await seedProject(deps);
    const todo = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 'Write copy', assigneeId: bob.id, dueDate: '2026-11-01' }));
    expect(todo).toMatchObject({ projectId: project.id, listId: list.id, title: 'Write copy', assigneeId: bob.id, dueDate: '2026-11-01', done: false, completedAt: null });
  });

  it('validates title, due date, and that the assignee is a project member', async () => {
    const deps = fakeDeps();
    const { alice, mallory, list } = await seedProject(deps);
    expectError(createTodo(deps, { actorId: alice.id, listId: list.id, title: '' }), 'validation');
    expectError(createTodo(deps, { actorId: alice.id, listId: list.id, title: 'x', dueDate: '2026-02-30' }), 'validation');
    const err = expectError(createTodo(deps, { actorId: alice.id, listId: list.id, title: 'x', assigneeId: mallory.id }), 'validation');
    expect(err.fields).toHaveProperty('assigneeId');
    expectError(createTodo(deps, { actorId: mallory.id, listId: list.id, title: 'x' }), 'forbidden');
    expectError(createTodo(deps, { actorId: alice.id, listId: 'nope', title: 'x' }), 'not_found');
  });
});

describe('updateTodo', () => {
  it('patches fields; null clears assignee and due date', async () => {
    const deps = fakeDeps();
    const { alice, bob, list } = await seedProject(deps);
    const todo = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 't', assigneeId: bob.id, dueDate: '2026-11-01' }));
    const kept = unwrap(updateTodo(deps, { actorId: bob.id, todoId: todo.id, title: 'T2' }));
    expect(kept).toMatchObject({ title: 'T2', assigneeId: bob.id, dueDate: '2026-11-01' });
    const cleared = unwrap(updateTodo(deps, { actorId: bob.id, todoId: todo.id, assigneeId: null, dueDate: null }));
    expect(cleared).toMatchObject({ assigneeId: null, dueDate: null });
  });

  it('moves between lists of the same project only', async () => {
    const deps = fakeDeps();
    const { alice, project, list } = await seedProject(deps);
    const other = unwrap(createTodoList(deps, { actorId: alice.id, projectId: project.id, name: 'Other' }));
    const todo = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 't' }));
    expect(unwrap(updateTodo(deps, { actorId: alice.id, todoId: todo.id, listId: other.id })).listId).toBe(other.id);
    expectError(updateTodo(deps, { actorId: alice.id, todoId: todo.id, listId: 'elsewhere' }), 'not_found');
  });
});

describe('setTodoCompletion', () => {
  it('completes and reopens, stamping completedAt', async () => {
    const deps = fakeDeps();
    const { alice, mallory, list } = await seedProject(deps);
    const todo = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 't' }));
    deps.clock.advance(5000);
    const done = unwrap(setTodoCompletion(deps, { actorId: alice.id, todoId: todo.id, done: true }));
    expect(done).toMatchObject({ done: true, completedAt: '2026-10-17T12:00:05.000Z' });
    deps.clock.advance(5000);
    expect(unwrap(setTodoCompletion(deps, { actorId: alice.id, todoId: todo.id, done: true })).completedAt).toBe('2026-10-17T12:00:05.000Z');
    expect(unwrap(setTodoCompletion(deps, { actorId: alice.id, todoId: todo.id, done: false }))).toMatchObject({ done: false, completedAt: null });
    expectError(setTodoCompletion(deps, { actorId: mallory.id, todoId: todo.id, done: true }), 'forbidden');
    expectError(setTodoCompletion(deps, { actorId: alice.id, todoId: todo.id, done: 'yes' as unknown as boolean }), 'validation');
  });
});

describe('deleteTodo', () => {
  it('deletes the to-do and its comments', async () => {
    const deps = fakeDeps();
    const { alice, mallory, list } = await seedProject(deps);
    const todo = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 't' }));
    unwrap(addComment(deps, { actorId: alice.id, parentType: 'todo', parentId: todo.id, body: 'c' }));
    expectError(deleteTodo(deps, { actorId: mallory.id, todoId: todo.id }), 'forbidden');
    unwrap(deleteTodo(deps, { actorId: alice.id, todoId: todo.id }));
    expect(deps.store.todos.size).toBe(0);
    expect(deps.store.comments.size).toBe(0);
  });
});

describe('listTodoLists', () => {
  it('groups to-dos by list, open first, with counts and resolved people', async () => {
    const deps = fakeDeps();
    const { alice, bob, mallory, project, list } = await seedProject(deps);
    const a = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 'a' }));
    deps.clock.advance(1);
    const b = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 'b', assigneeId: bob.id }));
    unwrap(setTodoCompletion(deps, { actorId: alice.id, todoId: a.id, done: true }));
    unwrap(addComment(deps, { actorId: bob.id, parentType: 'todo', parentId: b.id, body: 'on it' }));
    deps.clock.advance(1);
    unwrap(createTodoList(deps, { actorId: alice.id, projectId: project.id, name: 'Empty' }));

    const lists = unwrap(listTodoLists(deps, { actorId: bob.id, projectId: project.id }));
    expect(lists.map((l) => l.name)).toEqual(['Tasks', 'Empty']);
    const first = lists[0]!;
    expect(first.todos.map((t) => t.title)).toEqual(['b', 'a']);
    expect(first.todos[0]).toMatchObject({ assignee: { name: 'Bob' }, commentCount: 1, createdBy: { name: 'Alice' } });
    expect(first).toMatchObject({ totalCount: 2, completedCount: 1 });
    expect(lists[1]).toMatchObject({ todos: [], totalCount: 0 });
    expectError(listTodoLists(deps, { actorId: mallory.id, projectId: project.id }), 'forbidden');
  });
});

describe('getTodo', () => {
  it('returns the to-do with its list name and comment thread', async () => {
    const deps = fakeDeps();
    const { alice, bob, mallory, list } = await seedProject(deps);
    const todo = unwrap(createTodo(deps, { actorId: alice.id, listId: list.id, title: 't' }));
    unwrap(addComment(deps, { actorId: bob.id, parentType: 'todo', parentId: todo.id, body: 'first' }));
    deps.clock.advance(1);
    unwrap(addComment(deps, { actorId: alice.id, parentType: 'todo', parentId: todo.id, body: 'second' }));
    const detail = unwrap(getTodo(deps, { actorId: alice.id, todoId: todo.id }));
    expect(detail.list).toEqual({ id: list.id, name: 'Tasks' });
    expect(detail.comments.map((c) => [c.author?.name, c.body])).toEqual([['Bob', 'first'], ['Alice', 'second']]);
    expect(detail.commentCount).toBe(2);
    expectError(getTodo(deps, { actorId: mallory.id, todoId: todo.id }), 'forbidden');
    expectError(getTodo(deps, { actorId: alice.id, todoId: 'nope' }), 'not_found');
  });
});
