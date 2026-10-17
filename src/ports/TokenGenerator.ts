/** Produces unguessable, URL-safe secrets (session tokens). */
export interface TokenGenerator {
  next(): string;
}
