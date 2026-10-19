#!/usr/bin/env node
/**
 * Camp CLI — a third adapter over the same commands/queries as the REST API and MCP server (see
 * DECISIONS.md / README "Architecture": a `Camp` from `composeCamp(db)` and nothing else changes
 * in domain/ or ports/). Opens the SQLite database directly; no running server required.
 *
 * Requires a token, always — there is no email/password fallback here (unlike mcp-stdio.ts),
 * since a CLI is scriptable and a long-lived personal access token is the right credential for
 * that: mint one with `create-access-token` (bootstrap that one call via the web app, the REST
 * API, or an MCP client), then:
 *
 *   camp <command> [--flag value ...] --token <token>
 *   CAMP_TOKEN=<token> camp <command> [--flag value ...]
 *
 * CAMP_DB (or --db) selects the database file (default data/camp.db). Run `camp help` for the
 * full command list, or `camp help <command>` for one command's flags.
 */
import { DEFAULT_DB_FILE, openCamp } from './compose.js';
import { parseGlobalFlags } from './adapters/cli/flags.js';
import { printHelp, runCli } from './adapters/cli/run.js';

async function main(): Promise<void> {
  const { token, dbFile, rest } = parseGlobalFlags(process.argv.slice(2));
  const [name] = rest;

  if (!name || name === 'help' || name === '--help' || name === '-h') {
    printHelp(name === 'help' ? rest[1] : undefined);
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

  const { camp } = openCamp(dbFile ?? DEFAULT_DB_FILE);
  const me = camp.queries.getCurrentUser({ token });
  if (!me.ok) {
    console.error(`camp: ${me.error.message}`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = await runCli(camp, me.value, rest);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
