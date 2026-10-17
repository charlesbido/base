import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Camp, UserSummary } from '../../domain/index.js';
import { registerCampTools } from './tools.js';

/** A fresh MCP server exposing Camp's commands/queries as tools, acting as `actor`. */
export function createCampMcpServer(camp: Camp, actor: UserSummary): McpServer {
  const server = new McpServer(
    { name: 'camp', version: '0.1.0' },
    {
      instructions:
        'Camp is a Basecamp-style project tool. Start with list_projects, then use project-scoped tools ' +
        '(list_todos, list_messages, list_docs, list_events, read_campfire) with the returned ids.',
    },
  );
  registerCampTools(server, camp, actor);
  return server;
}
