import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  /** Re-run the loader (e.g. after a mutation). Keeps showing old data while reloading. */
  reload: () => Promise<void>;
}

/** Minimal data-loading hook: runs `load` when `deps` change; ignores stale responses. */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);

  const run = useCallback(load, deps);

  const reload = useCallback(async () => {
    const mine = ++generation.current;
    setLoading(true);
    try {
      const value = await run();
      if (mine === generation.current) {
        setData(value);
        setError(undefined);
      }
    } catch (e) {
      if (mine === generation.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (mine === generation.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
