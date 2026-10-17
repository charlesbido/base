import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { requireMember, userDirectory } from '../shared.js';
import type { Id, UserSummary } from '../types.js';
import type { ProjectDetail } from '../views.js';

export interface GetProjectInput {
  actorId: Id;
  projectId: Id;
}

export type GetProjectDeps = Pick<
  CampDeps,
  'projects' | 'users' | 'todos' | 'posts' | 'docs' | 'schedule' | 'clock'
>;

/** The project "home": details, members, and at-a-glance counts for each tool. */
export function getProject(deps: GetProjectDeps, input: GetProjectInput): Result<ProjectDetail> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;
  const p = access.project;

  const memberIds = deps.projects.listMemberIds(p.id);
  const user = userDirectory(deps.users, [...memberIds, p.createdBy]);
  const todos = deps.todos.listTodosByProject(p.id);
  const completed = todos.filter((t) => t.done).length;

  return ok({
    id: p.id,
    name: p.name,
    description: p.description,
    createdBy: user(p.createdBy),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    members: memberIds.map(user).filter((u): u is UserSummary => u !== null),
    stats: {
      openTodos: todos.length - completed,
      completedTodos: completed,
      posts: deps.posts.listByProject(p.id).length,
      docs: deps.docs.listByProject(p.id).length,
      upcomingEvents: deps.schedule.listByProject(p.id, { from: deps.clock.now().toISOString() }).length,
    },
  });
}
