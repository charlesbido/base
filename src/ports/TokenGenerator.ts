/** Produces and fingerprints unguessable, URL-safe secrets (session tokens, access tokens). */
export interface TokenGenerator {
  next(): string;
  /** A deterministic fingerprint of a token, safe to store and look up by (the raw value is not persisted). */
  hash(token: string): string;
}
