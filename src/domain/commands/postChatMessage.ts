import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import { nowIso, requireMember } from '../shared.js';
import type { ChatMessage, Id } from '../types.js';
import { Validator } from '../validation.js';

export interface PostChatMessageInput {
  actorId: Id;
  projectId: Id;
  body: string;
}

export type PostChatMessageDeps = Pick<CampDeps, 'projects' | 'chat' | 'ids' | 'clock'>;

/** Says something in the project's Campfire. */
export function postChatMessage(deps: PostChatMessageDeps, input: PostChatMessageInput): Result<ChatMessage> {
  const access = requireMember(deps.projects, input.projectId, input.actorId);
  if (!access.ok) return access;

  const v = new Validator();
  const body = v.requiredString(input.body, 'body', 4000);
  const invalid = v.failure();
  if (invalid) return invalid;

  const message: ChatMessage = {
    id: deps.ids.next(),
    projectId: input.projectId,
    authorId: input.actorId,
    body,
    createdAt: nowIso(deps.clock),
  };
  deps.chat.insert(message);
  return ok(message);
}
