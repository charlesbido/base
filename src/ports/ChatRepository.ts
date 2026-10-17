import type { ChatMessage, Id, ISODateTime } from '../domain/types.js';

export interface ChatQueryOptions {
  /** Only messages created at or after this instant (inclusive, so clients de-dupe by id). */
  since?: ISODateTime;
  /** Maximum number of messages; the MOST RECENT ones are kept. */
  limit: number;
}

export interface ChatRepository {
  insert(message: ChatMessage): void;
  /** Messages in chronological order (oldest first). */
  listByProject(projectId: Id, options: ChatQueryOptions): ChatMessage[];
}
