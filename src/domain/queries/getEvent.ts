import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { requireMember, userDirectory } from '../shared.js';
import type { Id } from '../types.js';
import type { EventView } from '../views.js';
import { eventView } from './listEvents.js';

export interface GetEventInput {
  actorId: Id;
  eventId: Id;
}

export type GetEventDeps = Pick<CampDeps, 'projects' | 'schedule' | 'users'>;

export function getEvent(deps: GetEventDeps, input: GetEventInput): Result<EventView> {
  const event = deps.schedule.findById(input.eventId);
  if (!event) return notFound('Event');
  const access = requireMember(deps.projects, event.projectId, input.actorId);
  if (!access.ok) return access;
  return ok(eventView(event, userDirectory(deps.users, [event.createdBy])));
}
