import type { CampDeps } from '../../ports/index.js';
import { ok, type Result } from '../result.js';
import type { AccessToken, Id } from '../types.js';
import { Validator } from '../validation.js';
import type { AccessTokenCreated } from '../views.js';

export interface CreateAccessTokenInput {
  actorId: Id;
  name: string;
  /** Days until expiry; omitted or null means the token never expires. */
  expiresInDays?: number | null;
}

export type CreateAccessTokenDeps = Pick<CampDeps, 'accessTokens' | 'ids' | 'tokens' | 'clock'>;

const MAX_EXPIRY_DAYS = 3650; // 10 years

/**
 * Mints a long-lived personal access token for scripts and MCP clients, which can't go through
 * the browser login/cookie dance when a 30-day Session expires. Works anywhere a Session bearer
 * token does (REST API, MCP streamable-HTTP, MCP stdio's CAMP_TOKEN).
 */
export function createAccessToken(deps: CreateAccessTokenDeps, input: CreateAccessTokenInput): Result<AccessTokenCreated> {
  const v = new Validator();
  const name = v.requiredString(input.name, 'name', 100);
  if (input.expiresInDays !== undefined && input.expiresInDays !== null) {
    const n = input.expiresInDays;
    v.check(
      typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= MAX_EXPIRY_DAYS,
      'expiresInDays',
      `expiresInDays must be a positive integer of at most ${MAX_EXPIRY_DAYS}, or omitted for no expiry`,
    );
  }
  const invalid = v.failure();
  if (invalid) return invalid;

  const now = deps.clock.now();
  const raw = deps.tokens.next();
  const expiresAt =
    input.expiresInDays == null ? null : new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const token: AccessToken = {
    id: deps.ids.next(),
    userId: input.actorId,
    name,
    tokenHash: deps.tokens.hash(raw),
    createdAt: now.toISOString(),
    expiresAt,
    revokedAt: null,
  };
  deps.accessTokens.insert(token);
  return ok({ id: token.id, name: token.name, token: raw, createdAt: token.createdAt, expiresAt: token.expiresAt });
}
