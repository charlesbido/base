/**
 * Read-model types are shared with the backend (type-only import, erased at build time), so the
 * client can never drift from what the queries actually return.
 */
export type * from '../../../src/domain/views.js';
export type { DomainError, ErrorCode } from '../../../src/domain/result.js';
