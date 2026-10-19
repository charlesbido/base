#!/usr/bin/env node
/**
 * Camp CLI — a thin REST client over the api.* vhost: the exact same HTTP API curl or the web
 * app talks to (see adapters/http/apiApp.ts). No local database access and no email/password
 * fallback (unlike mcp-stdio.ts) — every invocation needs a server to call and a token to call it
 * with, since this is meant to be run against a real (possibly remote) Camp deployment:
 *
 *   camp <command> [--flag value ...] --server-url <url> --token <token>
 *   CAMP_SERVER_URL=<url> CAMP_TOKEN=<token> camp <command> [--flag value ...]
 *
 * <url> is the api.* vhost's base URL, e.g. http://api.localhost:3000 or https://api.example.com
 * (--remote-url is accepted as an alias for --server-url). Run `camp help` for the full command
 * list, or `camp help <command>` for one command's flags.
 */
import { parseGlobalFlags } from './adapters/cli/flags.js';
import { createRestClient } from './adapters/cli/httpClient.js';
import { printHelp, runCli } from './adapters/cli/run.js';

async function main(): Promise<void> {
  const { token, serverUrl, rest } = parseGlobalFlags(process.argv.slice(2));
  const [name] = rest;

  if (!name || name === 'help' || name === '--help' || name === '-h') {
    printHelp(name === 'help' ? rest[1] : undefined);
    return;
  }

  if (!serverUrl) {
    console.error(
      'camp: missing server URL. Pass --server-url <url>, or set CAMP_SERVER_URL in the environment.\n' +
        'This is the api.* vhost, e.g. http://api.localhost:3000 or https://api.example.com.',
    );
    process.exitCode = 1;
    return;
  }
  if (!token) {
    console.error(
      'camp: missing token. Pass --token <token>, or set CAMP_TOKEN in the environment.\n' +
        'Mint a personal access token first (web app: Account -> Access tokens, or POST api.*/access-tokens).',
    );
    process.exitCode = 1;
    return;
  }

  const client = createRestClient(serverUrl, token);
  process.exitCode = await runCli(client, rest);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
