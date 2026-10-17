import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { Id, ISODateTime, ScheduleEvent } from '../types.js';
import { Validator } from '../validation.js';

export interface CreateEventInput {
  actorId: Id;
  projectId: Id;
  title: string;
  description?: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
}

export type CreateEventDeps = Pick<CampDeps, 'projects' | 'schedule' | 'ids' | 'clock'>;

export function createEvent(deps: CreateEventDeps, input: CreateEventInput): Result<ScheduleEvent> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const title = v.requiredString(input.title, 'title', 200);
  const description = v.optionalString(input.description, 'description', 10_000);
  const startsAt = v.dateTime(input.startsAt, 'startsAt');
  const endsAt = v.dateTime(input.endsAt, 'endsAt');
  if (startsAt && endsAt) v.check(endsAt >= startsAt, 'endsAt', 'endsAt must not be before startsAt');
  const invalid = v.failure();
  if (invalid) return invalid;

  const now = nowIso(deps.clock);
  const event: ScheduleEvent = {
    id: deps.ids.next(),
    projectId: input.projectId,
    title,
    description,
    startsAt,
    endsAt,
    createdBy: input.actorId,
    createdAt: now,
    updatedAt: now,
  };
  deps.schedule.insert(event);
  return ok(event);
}
