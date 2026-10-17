import type { CampDeps } from '../../ports/index.js';
import { notFound, ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Id, ISODateTime, ScheduleEvent } from '../types.js';
import { Validator } from '../validation.js';

export interface UpdateEventInput {
  actorId: Id;
  eventId: Id;
  title?: string;
  description?: string;
  startsAt?: ISODateTime;
  endsAt?: ISODateTime;
}

export type UpdateEventDeps = Pick<CampDeps, 'projects' | 'schedule' | 'clock'>;

export function updateEvent(deps: UpdateEventDeps, input: UpdateEventInput): Result<ScheduleEvent> {
  const event = deps.schedule.findById(input.eventId);
  if (!event) return notFound('Event');
  const access = requireMember(deps.projects, event.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const title = v.patchRequiredString(input.title, 'title', 200);
  const description = v.patchOptionalString(input.description, 'description', 10_000);
  const startsAt = v.patchDateTime(input.startsAt, 'startsAt') ?? event.startsAt;
  const endsAt = v.patchDateTime(input.endsAt, 'endsAt') ?? event.endsAt;
  if (!v.hasErrors()) v.check(endsAt >= startsAt, 'endsAt', 'endsAt must not be before startsAt');
  const invalid = v.failure();
  if (invalid) return invalid;

  const updated: ScheduleEvent = {
    ...event,
    title: title ?? event.title,
    description: description ?? event.description,
    startsAt,
    endsAt,
    updatedAt: nowIso(deps.clock),
  };
  deps.schedule.update(updated);
  return ok(updated);
}
