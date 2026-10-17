import type { NextFunction, Request, Response } from 'express';
import type { Camp, UserSummary } from '../../domain/index.js';
import { send } from './respond.js';

export const SESSION_COOKIE = 'camp_session';

/** A session token may arrive as a cookie (browsers) or a Bearer header (scripts, MCP clients). */
export function tokenFrom(req: Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[SESSION_COOKIE] ?? '';
}

export interface AuthedLocals {
  actor: UserSummary;
  token: string;
}

/** Rejects unauthenticated requests; otherwise exposes the actor on res.locals. */
export function requireUser(camp: Camp) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = tokenFrom(req);
    const result = camp.queries.getCurrentUser({ token });
    if (!result.ok) return send(res, result);
    (res.locals as AuthedLocals).actor = result.value;
    (res.locals as AuthedLocals).token = token;
    next();
  };
}

export const actorOf = (res: Response): UserSummary => (res.locals as AuthedLocals).actor;
