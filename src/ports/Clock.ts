/** Source of "now". Injected so handlers are deterministic under test. */
export interface Clock {
  now(): Date;
}
