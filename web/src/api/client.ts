import type { DomainError } from './types';

/**
 * Where the API lives. By default it's same-origin at /api: the server mounts the REST API on
 * app.*\/api (and the Vite dev server proxies /api), so the session cookie is first-party.
 * Override with VITE_API_URL to point at another deployment.
 */
export function apiBase(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  return (configured ?? '/api').replace(/\/$/, '');
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly error: DomainError | { code: string; message: string; fields?: Record<string, string> },
  ) {
    super(error.message);
  }
  get fields(): Record<string, string> {
    return this.error.fields ?? {};
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method,
      credentials: 'include', // send the session cookie (also when VITE_API_URL is cross-origin)
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { code: 'network', message: `Cannot reach the API at ${apiBase()}` });
  }
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = (data as { error?: DomainError } | null)?.error;
    throw new ApiError(res.status, err ?? { code: 'http', message: `Request failed (${res.status})` });
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
