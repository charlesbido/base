import type { Id, ISODateTime, ScheduleEvent } from '../domain/types.js';

export interface EventRange {
  /** Only events ending at or after this instant. */
  from?: ISODateTime;
  /** Only events starting before this instant. */
  to?: ISODateTime;
}

export interface ScheduleRepository {
  insert(event: ScheduleEvent): void;
  update(event: ScheduleEvent): void;
  delete(id: Id): void;
  findById(id: Id): ScheduleEvent | null;
  /** Events overlapping the range, ordered by start time. */
  listByProject(projectId: Id, range?: EventRange): ScheduleEvent[];
}
