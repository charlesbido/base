/**
 * Every command and query returns a Result: either a value or a typed DomainError.
 * Adapters translate error codes into their own vocabulary (HTTP status, MCP isError, ...).
 */

export type ErrorCode = 'validation' | 'not_found' | 'forbidden' | 'unauthorized' | 'conflict';

export interface DomainError {
  code: ErrorCode;
  message: string;
  /** Per-field messages for validation errors. */
  fields?: Record<string, string>;
}

export interface Success<T> {
  ok: true;
  value: T;
}

export interface Failure {
  ok: false;
  error: DomainError;
}

export type Result<T> = Success<T> | Failure;

export const ok = <T>(value: T): Success<T> => ({ ok: true, value });

export const fail = (code: ErrorCode, message: string, fields?: Record<string, string>): Failure => ({
  ok: false,
  error: fields ? { code, message, fields } : { code, message },
});

export const notFound = (what: string): Failure => fail('not_found', `${what} not found`);
