import { describe, expect, it } from 'vitest';
import { isValidDate, Validator } from '../../src/domain/validation.js';

describe('Validator', () => {
  it('collects the first error per field', () => {
    const v = new Validator();
    v.requiredString('', 'name');
    v.check(false, 'name', 'second error');
    v.email('bad', 'email');
    const f = v.failure();
    expect(f?.error.code).toBe('validation');
    expect(f?.error.fields).toEqual({ name: 'name is required', email: 'email must be a valid email address' });
  });

  it('distinguishes unchanged, cleared, and set for nullable patches', () => {
    const v = new Validator();
    expect(v.patchNullableDate(undefined, 'd')).toBeUndefined();
    expect(v.patchNullableDate(null, 'd')).toBeNull();
    expect(v.patchNullableDate('', 'd')).toBeNull();
    expect(v.patchNullableDate('2026-01-31', 'd')).toBe('2026-01-31');
    expect(v.failure()).toBeNull();
  });

  it('validates real calendar dates', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-1-1')).toBe(false);
  });
});
