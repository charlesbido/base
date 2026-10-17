import type { DomainError } from './types';

/**
 * Where the API lives. On app.<domain> we call the sibling api.<domain> (same port);
 * otherwise (e.g. the Vite dev server on localhost:5173) default to api.localhost:3000.
 */
export function apiBase(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, '');
  const { protocol, host } = window.location;
  if (host.startsWith('app.')) return `${protocol}//api.${host.slice('app.'.length)}`;
  return 'http://api.localhost:3000';
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
      credentials: 'include', // send the session cookie cross-origin (app.* -> api.*)
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
