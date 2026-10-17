import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { requireMember, userDirectory } from '../shared.js';
import type { Id } from '../types.js';
import { Validator } from '../validation.js';
import type { ChatTranscript } from '../views.js';

export interface ListChatMessagesInput {
  actorId: Id;
  projectId: Id;
  /** Poll cursor from the previous response; omit for the initial load. */
  since?: string;
  limit?: number;
}

export type ListChatMessagesDeps = Pick<CampDeps, 'projects' | 'chat' | 'users'>;

export const DEFAULT_CHAT_LIMIT = 100;
export const MAX_CHAT_LIMIT = 500;

/**
 * Campfire transcript for polling clients. The initial load returns the latest messages; later
 * polls pass `since` = previous `cursor` and receive messages at/after it (clients de-dupe by id,
 * which makes the inclusive bound safe against same-millisecond writes).
 */
export function listChatMessages(
  deps: ListChatMessagesDeps,
  input: ListChatMessagesInput,
): Result<ChatTranscript> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const since = input.since ? v.dateTime(input.since, 'since') : undefined;
  const requested = input.limit ?? DEFAULT_CHAT_LIMIT;
  v.check(Number.isInteger(requested) && requested > 0, 'limit', 'limit must be a positive integer');
  const invalid = v.failure();
  if (invalid) return invalid;
  const limit = Math.min(requested, MAX_CHAT_LIMIT);

  const messages = deps.chat.listByProject(input.projectId, since ? { since, limit } : { limit });
  const user = userDirectory(deps.users, messages.map((m) => m.authorId));
  const last = messages[messages.length - 1];
  return ok({
    messages: messages.map((m) => ({
      id: m.id,
      projectId: m.projectId,
      body: m.body,
      author: user(m.authorId),
      createdAt: m.createdAt,
    })),
    cursor: last ? last.createdAt : (since ?? null),
  });
}
