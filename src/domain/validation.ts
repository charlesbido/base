import { fail, type Failure } from './result.js';
import type { ISODate, ISODateTime } from './types.js';

/**
 * Tiny runtime validator. Inputs arrive from untrusted adapters (HTTP bodies, MCP tool args),
 * so handlers re-check shapes at runtime even though they are typed at compile time.
 *
 * Usage: create one, call field checkers (each returns the normalised value), then `failure()`.
 */
export class Validator {
  private readonly errors: Record<string, string> = {};

  private error(field: string, message: string): void {
    if (!(field in this.errors)) this.errors[field] = message;
  }

  /** A required, trimmed, non-empty string. */
  requiredString(value: unknown, field: string, max = 200): string {
    if (typeof value !== 'string' || value.trim() === '') {
      this.error(field, `${field} is required`);
      return '';
    }
    const trimmed = value.trim();
    if (trimmed.length > max) this.error(field, `${field} must be at most ${max} characters`);
    return trimmed;
  }

  /** An optional string; missing/null becomes "" (for create) — use `patchString` for updates. */
  optionalString(value: unknown, field: string, max = 20_000): string {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') {
      this.error(field, `${field} must be a string`);
      return '';
    }
    if (value.length > max) this.error(field, `${field} must be at most ${max} characters`);
    return value.trim();
  }

  /** For partial updates: undefined means "leave unchanged". */
  patchRequiredString(value: unknown, field: string, max = 200): string | undefined {
    return value === undefined ? undefined : this.requiredString(value, field, max);
  }

  patchOptionalString(value: unknown, field: string, max = 20_000): string | undefined {
    return value === undefined ? undefined : this.optionalString(value, field, max);
  }

  id(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
      this.error(field, `${field} is required`);
      return '';
    }
    return value.trim();
  }

  /** undefined = unchanged, null/"" = clear, otherwise an id. */
  patchNullableId(value: unknown, field: string): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return this.id(value, field);
  }

  email(value: unknown, field = 'email'): string {
    const s = this.requiredString(value, field, 254).toLowerCase();
    if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) this.error(field, `${field} must be a valid email address`);
    return s;
  }

  password(value: unknown, field = 'password'): string {
    if (typeof value !== 'string' || value.length < 8) {
      this.error(field, `${field} must be at least 8 characters`);
      return '';
    }
    if (value.length > 72) this.error(field, `${field} must be at most 72 characters`);
    return value;
  }

  boolean(value: unknown, field: string): boolean {
    if (typeof value !== 'boolean') {
      this.error(field, `${field} must be true or false`);
      return false;
    }
    return value;
  }

  /** A calendar date "YYYY-MM-DD" that actually exists. undefined = unchanged, null/"" = clear. */
  patchNullableDate(value: unknown, field: string): ISODate | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value !== 'string' || !isValidDate(value)) {
      this.error(field, `${field} must be a date in YYYY-MM-DD format`);
      return null;
    }
    return value;
  }

  /** Any string Date.parse understands that carries an explicit time; normalised to UTC ISO. */
  dateTime(value: unknown, field: string): ISODateTime {
    if (typeof value !== 'string' || value.trim() === '') {
      this.error(field, `${field} is required`);
      return '';
    }
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) {
      this.error(field, `${field} must be an ISO-8601 date-time`);
      return '';
    }
    return new Date(ms).toISOString();
  }

  patchDateTime(value: unknown, field: string): ISODateTime | undefined {
    return value === undefined ? undefined : this.dateTime(value, field);
  }

  /** Add a custom error (for cross-field rules). */
  check(condition: boolean, field: string, message: string): void {
    if (!condition) this.error(field, message);
  }

  hasErrors(): boolean {
    return Object.keys(this.errors).length > 0;
  }

  failure(): Failure | null {
    if (!this.hasErrors()) return null;
    const first = Object.values(this.errors)[0];
    return fail('validation', first ?? 'Invalid input', { ...this.errors });
  }
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
