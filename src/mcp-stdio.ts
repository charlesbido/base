/**
 * MCP over stdio — for MCP clients that launch a local subprocess (Claude Desktop, Claude Code, ...).
 *
 * Authenticates once at startup, then every tool call acts as that user:
 *   CAMP_TOKEN=<session token>                    or
 *   CAMP_EMAIL=<email> CAMP_PASSWORD=<password>
 * CAMP_DB selects the database file (default data/camp.db). Logs go to stderr; stdout is the protocol.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCampMcpServer } from './adapters/mcp/createServer.js';
import { DEFAULT_DB_FILE, openCamp } from './compose.js';

async function main(): Promise<void> {
  const { camp } = openCamp(DEFAULT_DB_FILE);

  let token = process.env.CAMP_TOKEN ?? '';
  if (!token && process.env.CAMP_EMAIL) {
    const session = await camp.commands.login({ email: process.env.CAMP_EMAIL, password: process.env.CAMP_PASSWORD ?? '' });
    if (!session.ok) throw new Error(`Login failed: ${session.error.message}`);
    token = session.value.token;
  }
  const me = camp.queries.getCurrentUser({ token });
  if (!me.ok) throw new Error('Set CAMP_TOKEN, or CAMP_EMAIL and CAMP_PASSWORD, to a valid Camp account');

  const server = createCampMcpServer(camp, me.value);
  await server.connect(new StdioServerTransport());
  console.error(`Camp MCP (stdio) ready, acting as ${me.value.email}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
