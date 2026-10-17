/** Translation between domain Results and HTTP responses. */
import type { NextFunction, Request, Response } from 'express';
import type { ErrorCode, Result } from '../../domain/index.js';

export const STATUS_BY_CODE: Record<ErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
};

export function send<T>(res: Response, result: Result<T>, successStatus = 200): void {
  if (result.ok) {
    res.status(successStatus).json(result.value);
  } else {
    res.status(STATUS_BY_CODE[result.error.code]).json({ error: result.error });
  }
}

/** Last-resort error handler: malformed JSON is the client's fault, anything else is ours. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const e = err as { type?: string; status?: number; message?: string };
  if (e.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'validation', message: 'Request body is not valid JSON' } });
    return;
  }
  if (e.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'validation', message: 'Request body too large' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'internal', message: 'Internal server error' } });
}
