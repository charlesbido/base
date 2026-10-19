/**
 * Minimal REST client for the api.* vhost — the same HTTP API curl or the web app talks to.
 * The CLI never runs domain code or touches the database in-process; this is its only transport.
 * `CliResult`/`CliError` are a client-local mirror of the API's wire format (see respond.ts),
 * not an import of domain/result.ts, since this adapter has no runtime dependency on domain/.
 *
 * Uses node:http/node:https directly rather than fetch(): per RFC 6761, *.localhost always
 * resolves to loopback, which curl and browsers honour, but Node's own resolver does not (it
 * raises ENOTFOUND for a host like api.localhost that was never put in /etc/hosts or DNS). Since
 * *.localhost is exactly the setup the rest of Camp documents as the default (README: "app.*,
 * api.*, mcp.* resolve to 127.0.0.1 automatically"), the client special-cases it here: connect to
 * 127.0.0.1 but still send the real Host header, which is all vhost-based dispatch needs.
 */
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export interface CliError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export type CliResult<T> = { ok: true; value: T } | { ok: false; error: CliError };

export interface RequestOptions {
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
}

export interface RestClient {
  request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, options?: RequestOptions): Promise<CliResult<T>>;
}

const isLocalhost = (hostname: string): boolean => hostname === 'localhost' || hostname.endsWith('.localhost');

export function createRestClient(serverUrl: string, token: string): RestClient {
  const base = serverUrl.replace(/\/+$/, '');

  return {
    async request<T>(
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
      path: string,
      options: RequestOptions = {},
    ): Promise<CliResult<T>> {
      const url = new URL(base + path);
      for (const [key, value] of Object.entries(options.query ?? {})) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }

      const body = options.body !== undefined ? JSON.stringify(options.body) : undefined;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) } : {}),
      };
      const connectHost = isLocalhost(url.hostname) ? '127.0.0.1' : url.hostname;
      const doRequest = url.protocol === 'https:' ? httpsRequest : httpRequest;

      let statusCode: number;
      let text: string;
      try {
        ({ statusCode, text } = await new Promise<{ statusCode: number; text: string }>((resolve, reject) => {
          const req = doRequest(
            {
              hostname: connectHost,
              port: url.port || (url.protocol === 'https:' ? 443 : 80),
              path: url.pathname + url.search,
              method,
              headers: { ...headers, Host: url.host },
            },
            (res) => {
              let data = '';
              res.setEncoding('utf8');
              res.on('data', (chunk: string) => (data += chunk));
              res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, text: data }));
              res.on('error', reject);
            },
          );
          req.on('error', reject);
          if (body !== undefined) req.write(body);
          req.end();
        }));
      } catch (err) {
        return {
          ok: false,
          error: { code: 'unreachable', message: `Could not reach ${base}: ${err instanceof Error ? err.message : String(err)}` },
        };
      }

      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        return { ok: false, error: { code: 'bad_response', message: `${base} did not return valid JSON (HTTP ${statusCode})` } };
      }

      if (statusCode >= 200 && statusCode < 300) return { ok: true, value: json as T };
      const error =
        json && typeof json === 'object' && 'error' in json
          ? (json as { error: CliError }).error
          : { code: 'http_error', message: `HTTP ${statusCode}` };
      return { ok: false, error };
    },
  };
}
