import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { requireMember } from '../shared.js';
import type { Id } from '../types.js';

export interface DeleteEventInput {
  actorId: Id;
  eventId: Id;
}

export type DeleteEventDeps = Pick<CampDeps, 'projects' | 'schedule'>;

export function deleteEvent(deps: DeleteEventDeps, input: DeleteEventInput): Result<{ id: Id }> {
  const event = deps.schedule.findById(input.eventId);
  if (!event) return notFound('Event');
  const access = requireMember(deps.projects, event.projectId, input.actorId);
  if (!access.ok) return access;
  deps.schedule.delete(event.id);
  return ok({ id: event.id });
}
