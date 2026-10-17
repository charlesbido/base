/**
 * In-memory fakes for every port. They honour the same contracts as the SQLite adapters
 * (ordering, cascading deletes) so domain tests run fast with zero I/O.
 */
import type {
  CampDeps,
  ChatQueryOptions,
  ChatRepository,
  Clock,
  CommentRepository,
  DocRepository,
  EventRange,
  IdGenerator,
  PasswordHasher,
  PostRepository,
  ProjectRepository,
  ScheduleRepository,
  SessionRepository,
  TodoRepository,
  TokenGenerator,
  UserRepository,
} from '../../src/ports/index.js';
import type {
  ChatMessage,
  Comment,
  CommentParentType,
  Doc,
  Id,
  ISODateTime,
  Post,
  Project,
  ScheduleEvent,
  Session,
  Todo,
  TodoList,
  User,
} from '../../src/domain/types.js';

const clone = <T>(x: T): T => structuredClone(x);
const byCreated = <T extends { createdAt: string }>(a: T, b: T) => a.createdAt.localeCompare(b.createdAt);

export class Store {
  users = new Map<Id, User>();
  sessions = new Map<string, Session>();
  projects = new Map<Id, Project>();
  /** projectId -> (userId -> addedAt), insertion-ordered */
  members = new Map<Id, Map<Id, ISODateTime>>();
  lists = new Map<Id, TodoList>();
  todos = new Map<Id, Todo>();
  comments = new Map<Id, Comment>();
  posts = new Map<Id, Post>();
  docs = new Map<Id, Doc>();
  events = new Map<Id, ScheduleEvent>();
  chat: ChatMessage[] = [];

  deleteCommentsWhere(pred: (c: Comment) => boolean) {
    for (const [id, c] of this.comments) if (pred(c)) this.comments.delete(id);
  }
}

export class FakeUsers implements UserRepository {
  constructor(private s: Store) {}
  insert(user: User) {
    if ([...this.s.users.values()].some((u) => u.email === user.email)) throw new Error('UNIQUE email');
    this.s.users.set(user.id, clone(user));
  }
  findById(id: Id) {
    return clone(this.s.users.get(id) ?? null);
  }
  findByEmail(email: string) {
    return clone([...this.s.users.values()].find((u) => u.email === email) ?? null);
  }
  findManyByIds(ids: readonly Id[]) {
    return ids.flatMap((id) => (this.s.users.has(id) ? [clone(this.s.users.get(id)!)] : []));
  }
  list() {
    return [...this.s.users.values()].sort((a, b) => a.name.localeCompare(b.name)).map(clone);
  }
}

export class FakeSessions implements SessionRepository {
  constructor(private s: Store) {}
  insert(session: Session) {
    this.s.sessions.set(session.token, clone(session));
  }
  findByToken(token: string) {
    return clone(this.s.sessions.get(token) ?? null);
  }
  delete(token: string) {
    this.s.sessions.delete(token);
  }
}

export class FakeProjects implements ProjectRepository {
  constructor(private s: Store) {}
  insert(project: Project, memberIds: readonly Id[]) {
    this.s.projects.set(project.id, clone(project));
    this.s.members.set(project.id, new Map(memberIds.map((id) => [id, project.createdAt])));
  }
  update(project: Project) {
    this.s.projects.set(project.id, clone(project));
  }
  delete(id: Id) {
    const s = this.s;
    s.projects.delete(id);
    s.members.delete(id);
    for (const [k, v] of s.lists) if (v.projectId === id) s.lists.delete(k);
    for (const [k, v] of s.todos) if (v.projectId === id) s.todos.delete(k);
    for (const [k, v] of s.posts) if (v.projectId === id) s.posts.delete(k);
    for (const [k, v] of s.docs) if (v.projectId === id) s.docs.delete(k);
    for (const [k, v] of s.events) if (v.projectId === id) s.events.delete(k);
    s.deleteCommentsWhere((c) => c.projectId === id);
    s.chat = s.chat.filter((m) => m.projectId !== id);
  }
  findById(id: Id) {
    return clone(this.s.projects.get(id) ?? null);
  }
  listForUser(userId: Id) {
    return [...this.s.projects.values()]
      .filter((p) => this.isMember(p.id, userId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(clone);
  }
  addMember(projectId: Id, userId: Id, addedAt: ISODateTime) {
    this.s.members.get(projectId)?.set(userId, addedAt);
  }
  removeMember(projectId: Id, userId: Id) {
    this.s.members.get(projectId)?.delete(userId);
  }
  isMember(projectId: Id, userId: Id) {
    return this.s.members.get(projectId)?.has(userId) ?? false;
  }
  listMemberIds(projectId: Id) {
    return [...(this.s.members.get(projectId)?.keys() ?? [])];
  }
}

export class FakeTodos implements TodoRepository {
  constructor(private s: Store) {}
  insertList(list: TodoList) {
    this.s.lists.set(list.id, clone(list));
  }
  updateList(list: TodoList) {
    this.s.lists.set(list.id, clone(list));
  }
  deleteList(id: Id) {
    this.s.lists.delete(id);
    for (const [k, t] of this.s.todos) if (t.listId === id) this.deleteTodo(k);
  }
  findListById(id: Id) {
    return clone(this.s.lists.get(id) ?? null);
  }
  listListsByProject(projectId: Id) {
    return [...this.s.lists.values()].filter((l) => l.projectId === projectId).sort(byCreated).map(clone);
  }
  insertTodo(todo: Todo) {
    this.s.todos.set(todo.id, clone(todo));
  }
  updateTodo(todo: Todo) {
    this.s.todos.set(todo.id, clone(todo));
  }
  deleteTodo(id: Id) {
    this.s.todos.delete(id);
    this.s.deleteCommentsWhere((c) => c.parentType === 'todo' && c.parentId === id);
  }
  findTodoById(id: Id) {
    return clone(this.s.todos.get(id) ?? null);
  }
  listTodosByProject(projectId: Id) {
    return [...this.s.todos.values()].filter((t) => t.projectId === projectId).sort(byCreated).map(clone);
  }
}

export class FakeComments implements CommentRepository {
  constructor(private s: Store) {}
  insert(comment: Comment) {
    this.s.comments.set(comment.id, clone(comment));
  }
  delete(id: Id) {
    this.s.comments.delete(id);
  }
  findById(id: Id) {
    return clone(this.s.comments.get(id) ?? null);
  }
  listForParent(parentType: CommentParentType, parentId: Id) {
    return [...this.s.comments.values()]
      .filter((c) => c.parentType === parentType && c.parentId === parentId)
      .sort(byCreated)
      .map(clone);
  }
  countForParents(parentType: CommentParentType, parentIds: readonly Id[]) {
    const counts = new Map<Id, number>();
    for (const c of this.s.comments.values()) {
      if (c.parentType === parentType && parentIds.includes(c.parentId)) {
        counts.set(c.parentId, (counts.get(c.parentId) ?? 0) + 1);
      }
    }
    return counts;
  }
}

export class FakePosts implements PostRepository {
  constructor(private s: Store) {}
  insert(post: Post) {
    this.s.posts.set(post.id, clone(post));
  }
  update(post: Post) {
    this.s.posts.set(post.id, clone(post));
  }
  delete(id: Id) {
    this.s.posts.delete(id);
    this.s.deleteCommentsWhere((c) => c.parentType === 'post' && c.parentId === id);
  }
  findById(id: Id) {
    return clone(this.s.posts.get(id) ?? null);
  }
  listByProject(projectId: Id) {
    return [...this.s.posts.values()]
      .filter((p) => p.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(clone);
  }
}

export class FakeDocs implements DocRepository {
  constructor(private s: Store) {}
  insert(doc: Doc) {
    this.s.docs.set(doc.id, clone(doc));
  }
  update(doc: Doc) {
    this.s.docs.set(doc.id, clone(doc));
  }
  delete(id: Id) {
    this.s.docs.delete(id);
  }
  findById(id: Id) {
    return clone(this.s.docs.get(id) ?? null);
  }
  listByProject(projectId: Id) {
    return [...this.s.docs.values()]
      .filter((d) => d.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(clone);
  }
}

export class FakeSchedule implements ScheduleRepository {
  constructor(private s: Store) {}
  insert(event: ScheduleEvent) {
    this.s.events.set(event.id, clone(event));
  }
  update(event: ScheduleEvent) {
    this.s.events.set(event.id, clone(event));
  }
  delete(id: Id) {
    this.s.events.delete(id);
  }
  findById(id: Id) {
    return clone(this.s.events.get(id) ?? null);
  }
  listByProject(projectId: Id, range: EventRange = {}) {
    return [...this.s.events.values()]
      .filter((e) => e.projectId === projectId)
      .filter((e) => (range.from === undefined || e.endsAt >= range.from) && (range.to === undefined || e.startsAt < range.to))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(clone);
  }
}

export class FakeChat implements ChatRepository {
  constructor(private s: Store) {}
  insert(message: ChatMessage) {
    this.s.chat.push(clone(message));
  }
  listByProject(projectId: Id, options: ChatQueryOptions) {
    const matching = this.s.chat
      .filter((m) => m.projectId === projectId && (options.since === undefined || m.createdAt >= options.since))
      .sort(byCreated);
    return matching.slice(Math.max(0, matching.length - options.limit)).map(clone);
  }
}

/** A clock you can move by hand. Each call to now() returns the current fixed instant. */
export class FakeClock implements Clock {
  constructor(private current = new Date('2026-10-17T12:00:00.000Z')) {}
  now() {
    return new Date(this.current);
  }
  set(iso: string) {
    this.current = new Date(iso);
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequentialIds implements IdGenerator {
  private n = 0;
  constructor(private prefix = 'id') {}
  next() {
    return `${this.prefix}-${++this.n}`;
  }
}

/** Not a real hash — just reversible enough to prove the hasher was used. */
export class FakeHasher implements PasswordHasher {
  async hash(plain: string) {
    return `hashed:${plain}`;
  }
  async verify(plain: string, hash: string) {
    return hash === `hashed:${plain}`;
  }
}

export interface FakeDeps extends CampDeps {
  store: Store;
  clock: FakeClock;
}

export function fakeDeps(): FakeDeps {
  const store = new Store();
  return {
    store,
    users: new FakeUsers(store),
    sessions: new FakeSessions(store),
    projects: new FakeProjects(store),
    todos: new FakeTodos(store),
    comments: new FakeComments(store),
    posts: new FakePosts(store),
    docs: new FakeDocs(store),
    schedule: new FakeSchedule(store),
    chat: new FakeChat(store),
    clock: new FakeClock(),
    ids: new SequentialIds('id'),
    tokens: new SequentialIds('token') as TokenGenerator,
    passwords: new FakeHasher(),
  };
}
