import type { CampDeps, EventRange } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { requireMember, userDirectory } from '../shared.js';
import type { Id, ScheduleEvent, UserSummary } from '../types.js';
import { Validator } from '../validation.js';
import type { EventView } from '../views.js';

export interface ListEventsInput {
  actorId: Id;
  projectId: Id;
  /** Optional window; events overlapping [from, to) are returned. */
  from?: string;
  to?: string;
}

export type ListEventsDeps = Pick<CampDeps, 'projects' | 'schedule' | 'users'>;

/** The Schedule: events ordered by start time, optionally limited to a window. */
export function listEvents(deps: ListEventsDeps, input: ListEventsInput): Result<EventView[]> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const range: EventRange = {};
  if (input.from !== undefined && input.from !== '') range.from = v.dateTime(input.from, 'from');
  if (input.to !== undefined && input.to !== '') range.to = v.dateTime(input.to, 'to');
  const invalid = v.failure();
  if (invalid) return invalid;

  const events = deps.schedule.listByProject(input.projectId, range);
  const user = userDirectory(deps.users, events.map((e) => e.createdBy));
  return ok(events.map((e) => eventView(e, user)));
}

export function eventView(e: ScheduleEvent, user: (id: Id | null) => UserSummary | null): EventView {
  return {
    id: e.id,
    projectId: e.projectId,
    title: e.title,
    description: e.description,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    createdBy: user(e.createdBy),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}
