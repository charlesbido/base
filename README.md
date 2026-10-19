# Camp

A from-scratch, Basecamp-style project collaboration tool: **Projects** with **To-dos**, a
**Message Board**, **Docs**, a **Schedule**, a **Campfire** chat room, and **People**.

- Backend: Node.js + TypeScript (strict) + Express, SQLite via `better-sqlite3`
- Frontend: React + TypeScript + Vite + Mantine
- Architecture: CQRS command/query handlers in a pure domain layer, behind ports-and-adapters
- Adapters: REST API, MCP server (Streamable HTTP and stdio), SQLite persistence

The judgment calls behind all of this are listed in [DECISIONS.md](DECISIONS.md).

## Quick start

Requires Node.js 20.11 or newer (developed on 22).

```sh
pnpm install        # installs the backend and the web/ workspace
pnpm run build      # tsc (backend) + tsc + vite build (frontend) -> dist/ and web/dist/
pnpm test           # vitest: domain unit tests, SQLite/HTTP/MCP integration tests
pnpm start          # node dist/server.js on port 3000
```

Then open **http://app.localhost:3000** and create an account.

For development, `pnpm run dev` runs the server with `tsx watch` (it serves whatever is in
`web/dist`). For frontend hot reload, also run `pnpm run dev:web` and open http://localhost:5173.
The Vite dev server proxies `/api` to the backend.

| Env var          | Default        | Meaning                                                      |
| ---------------- | -------------- | ------------------------------------------------------------ |
| `PORT`           | `3000`         | The single port that serves all three vhosts                 |
| `CAMP_DB`        | `data/camp.db` | SQLite file; created and migrated automatically              |
| `CORS_ORIGINS`   | (none)         | Comma-separated browser origins allowed to call `api.*`     |
| `SECURE_COOKIES` | `false`        | Set to `true` behind HTTPS                                   |
| `WEB_DIST`       | `web/dist`     | Built SPA directory served on `app.*`                        |

## Three vhosts, one port

One Express server dispatches on the `Host` header (via the `vhost` package):

| Host           | Serves                                                                          |
| -------------- | ------------------------------------------------------------------------------- |
| `app.*`        | The React SPA, plus the same REST API mounted at `/api` (see below)             |
| `api.*`        | The REST API                                                                    |
| `mcp.*`        | The MCP server: Streamable HTTP at `POST /mcp`                                  |

Any other host (for example plain `localhost:3000`, or a reverse proxy/tunnel hostname like a
Tailscale MagicDNS name) falls back to the `app.*` app rather than a dead end.

`app.localhost`, `api.localhost` and `mcp.localhost` resolve to 127.0.0.1 automatically on most
systems (RFC 6761 reserves `.localhost`; Chrome, Firefox, curl and systemd-resolved all handle
it), so you don't need to edit `/etc/hosts`. If your resolver doesn't support it, send the
`Host` header yourself:

```sh
curl -H 'Host: api.localhost' http://127.0.0.1:3000/health
curl -H 'Host: app.localhost' http://127.0.0.1:3000/
curl -H 'Host: mcp.localhost' http://127.0.0.1:3000/
```

**Why the SPA calls `app.*/api` and not `api.*`:** under the Public Suffix List's default rule,
`app.localhost` and `api.localhost` count as different *sites*. Browsers therefore won't send a
`SameSite=Lax` session cookie set by `api.*` on `fetch`es made from `app.*`. So `app.*/api` mounts
the **same Express API app instance** in-process (no proxy, no duplicated code), which keeps the
browser's cookie first-party. `api.*` is still the canonical API for curl, scripts and other
clients. Details are in DECISIONS.md.

## REST API walkthrough (curl)

Every one of these commands was run against `pnpm run dev`. To authenticate, use either the
`camp_session` cookie (browsers) or `Authorization: Bearer <token>`.

```sh
# 1. Register. This also signs you in, and the response includes a session token.
curl -s -X POST http://api.localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","name":"Ada","password":"password123"}'

TOKEN=$(curl -s -X POST http://api.localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"password123"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# 2. Create a project
PROJECT=$(curl -s -X POST http://api.localhost:3000/projects \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Website redesign"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')

# 3. Create a to-do list, then add a to-do to it
LIST=$(curl -s -X POST http://api.localhost:3000/projects/$PROJECT/todolists \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Launch"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')

curl -s -X POST http://api.localhost:3000/todolists/$LIST/todos \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Write homepage copy","dueDate":"2026-11-01"}'

# 4. Read it back
curl -s http://api.localhost:3000/projects/$PROJECT/todolists -H "Authorization: Bearer $TOKEN"
```

### Long-lived access tokens (for MCP clients and scripts)

A session token from `/auth/login` expires after 30 days with no refresh path — fine for a
browser, awkward for an MCP client or a cron job. A personal access token (PAT) is the fix: mint
one from the web app (Account menu → Access tokens) or the API, and it works everywhere a session
token does — the REST API, both MCP transports — until you revoke it.

```sh
# Mint a token that never expires (pass "expiresInDays": 90 for one that does)
curl -s -X POST http://api.localhost:3000/access-tokens \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"laptop MCP client"}'
# {"id":"...","name":"laptop MCP client","token":"<shown once>","createdAt":"...","expiresAt":null}

# List your tokens (never shows the raw value again) / revoke one
curl -s http://api.localhost:3000/access-tokens -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE http://api.localhost:3000/access-tokens/<id> -H "Authorization: Bearer $TOKEN"
```

Only the token's SHA-256 hash is stored; the raw value is shown exactly once, at creation.

### Endpoints

| Area       | Endpoints |
| ---------- | --------- |
| Auth       | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` |
| People     | `GET /users` |
| Access tokens | `GET/POST /access-tokens` · `DELETE /access-tokens/:id` |
| Projects   | `GET/POST /projects` · `GET/PATCH/DELETE /projects/:id` · `POST /projects/:id/members` (`{email}` or `{userId}`) · `DELETE /projects/:id/members/:userId` |
| To-dos     | `GET/POST /projects/:id/todolists` · `PATCH/DELETE /todolists/:id` · `POST /todolists/:id/todos` · `GET/PATCH/DELETE /todos/:id` · `POST/DELETE /todos/:id/completion` · `POST /todos/:id/comments` |
| Messages   | `GET/POST /projects/:id/posts` · `GET/PATCH/DELETE /posts/:id` · `POST /posts/:id/comments` |
| Comments   | `DELETE /comments/:id` |
| Docs       | `GET/POST /projects/:id/docs` · `GET/PATCH/DELETE /docs/:id` |
| Schedule   | `GET /projects/:id/events?from=&to=` · `POST /projects/:id/events` · `GET/PATCH/DELETE /events/:id` |
| Campfire   | `GET /projects/:id/chat?since=&limit=` · `POST /projects/:id/chat` |

Errors look like `{"error":{"code","message","fields?"}}`, with these statuses: `validation` → 400,
`unauthorized` → 401, `forbidden` → 403, `not_found` → 404, `conflict` → 409.

## MCP server

The MCP adapter exposes the **same** commands and queries as tools: `whoami`, `list_people`,
`list_projects`, `get_project`, `create_project`, `update_project`, `add_project_member`,
`remove_project_member`, `list_todos`, `get_todo`, `create_todo_list`, `create_todo`,
`update_todo`, `complete_todo`, `uncomplete_todo`, `delete_todo`, `comment_on_todo`,
`list_messages`, `get_message`, `post_message`, `comment_on_message`, `list_docs`, `get_doc`,
`create_doc`, `update_doc`, `list_events`, `create_event`, `update_event`, `delete_event`,
`read_campfire`, `send_campfire_message`, `list_access_tokens`, `create_access_token`,
`revoke_access_token`.

### Streamable HTTP (on `mcp.*`)

The server is stateless: each `POST /mcp` is self-contained and authenticated with a Camp session
token. Using `$TOKEN` from the walkthrough above, this is the exact command used to verify it:

```sh
curl -s -X POST http://mcp.localhost:3000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_projects","arguments":{}}}'
```

It returned:

```json
{"result":{"content":[{"type":"text","text":"[\n  {\n    \"id\": \"d1e5…\",\n    \"name\": \"Website redesign\",\n    \"description\": \"\",\n    \"memberCount\": 1,\n    \"updatedAt\": \"2026-10-17T16:51:28.050Z\"\n  }\n]"}]},"jsonrpc":"2.0","id":1}
```

A write goes through the same way, and the result then shows up in the REST API:

```sh
curl -s -X POST http://mcp.localhost:3000/mcp \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"create_todo\",\"arguments\":{\"listId\":\"$LIST\",\"title\":\"Added via MCP\"}}}"
```

To connect an MCP client (Claude Code, MCP Inspector, …), point it at
`http://mcp.localhost:3000/mcp` and pass the header `Authorization: Bearer <token>`.
`test/integration/http.test.ts` also drives this endpoint with the official SDK `Client`.

**Use a long-lived access token instead of a session token** so the connection survives past 30
days: mint one with `POST /access-tokens` (see above) and pass it the same way —
`Authorization: Bearer <access token>`. `getCurrentUser` accepts either kind transparently, so no
other part of the setup changes. `test/integration/http.test.ts` has a dedicated test for this.

### stdio

For clients that launch a subprocess:

```sh
CAMP_EMAIL=ada@example.com CAMP_PASSWORD=password123 pnpm run --silent mcp:stdio
# or CAMP_TOKEN=<session or access token> pnpm run --silent mcp:stdio
```

For a client config you set up once and forget (the common case for stdio clients), prefer
`CAMP_TOKEN=<access token>` over `CAMP_EMAIL`/`CAMP_PASSWORD` or a session token — it's the same
long-lived personal access token from the walkthrough above, and it won't go stale after 30 days.

Verified with:

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"shell","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_projects","arguments":{}}}' \
| CAMP_EMAIL=ada@example.com CAMP_PASSWORD=password123 npx tsx src/mcp-stdio.ts
```

Example client config:

```json
{
  "mcpServers": {
    "camp": {
      "command": "npx",
      "args": ["tsx", "/path/to/camp/src/mcp-stdio.ts"],
      "env": { "CAMP_DB": "/path/to/camp/data/camp.db", "CAMP_EMAIL": "ada@example.com", "CAMP_PASSWORD": "password123" }
    }
  }
}
```

## CLI

A third adapter over the same commands/queries, no server required — it opens the SQLite database
directly (`compose.ts`). Always requires a token (`--token <token>` or `CAMP_TOKEN=`); mint one
with `POST api.*/access-tokens`, the web app's Access tokens page, or MCP's `create_access_token`.

```sh
pnpm run build
PROJECT=$(node dist/cli.js create-project --name "Website redesign" --token "$TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
node dist/cli.js list-todos --project-id "$PROJECT" --token "$TOKEN"
node dist/cli.js help                 # every command
node dist/cli.js help create-todo     # one command's flags
```

Command coverage is a superset of the MCP tool list (it also includes deletes/updates MCP omits
for agent safety), since a human at a terminal gets the REST API's full CRUD surface. See
`.claude/skills/camp-cli/SKILL.md` for the full command reference, output/exit-code conventions,
and how to symlink `dist/cli.js` onto `PATH` as `camp` so it's callable from any directory.

## Architecture

```
src/
  domain/            pure business logic; imports nothing but itself and ports/
    commands/        one write handler per file: (deps, input) => Result<T>
    queries/         one read handler per file:  (deps, input) => Result<View>
    types.ts         entities        views.ts  read models (shared with web/)
    result.ts        Result / DomainError      validation.ts  runtime input checks
    index.ts         createCamp(deps): binds every handler -> { commands, queries }
  ports/             interfaces only: repositories, Clock, IdGenerator, TokenGenerator, PasswordHasher
  adapters/
    sqlite/          one repository per port, hand-written SQL, migrations in database.ts
    system/          SystemClock, UuidGenerator, CryptoTokenGenerator, BcryptPasswordHasher
    http/            Express REST adapter + static SPA host
    mcp/             MCP tool definitions + Streamable HTTP app
    cli/             CLI command table, flag parsing, dispatch (see "CLI" above)
  compose.ts         composition root: SQLite + system adapters -> Camp
  server.ts          vhost wiring, one HTTP server
  mcp-stdio.ts       stdio MCP entrypoint
  cli.ts             CLI entrypoint
web/                 React SPA (pnpm workspace; imports domain view types type-only)
test/
  fakes/             in-memory implementations of every port
  domain/            unit tests for every command and query (no I/O)
  integration/       real SQLite adapters; full HTTP + vhost + MCP client round-trips
  architecture.test.ts  fails if domain/ or ports/ import an adapter, framework or I/O library
```

**CQRS.** Every write is a command handler and every read is a query handler. They're separate
files with separate code paths, and no class both mutates and reads. Queries return read models
shaped for one specific screen. For example, `listTodoLists` returns lists with their to-dos
already ordered open-first, with assignees resolved and comment counts attached. Both sides share
one SQLite database (see DECISIONS.md).

**Ports and adapters.** Handlers depend only on the `ports/` interfaces, injected as a narrow
`Pick<CampDeps, …>`. Adapters get a `Camp` facade (`camp.commands.createTodo(...)`,
`camp.queries.getProject(...)`) and never touch repositories. That's why the REST and MCP
adapters stay thin translations over the same handlers. Membership checks, validation and
ownership rules all live in `domain/`. To add a CLI, build a `Camp` with `composeCamp(db)` and
call the same methods; nothing in `domain/` or `ports/` changes.

## Scripts

| Script               | Does |
| -------------------- | ---- |
| `pnpm run build`      | Typecheck and compile the backend to `dist/`, then typecheck and build the SPA to `web/dist/` |
| `pnpm test`           | Run all Vitest suites |
| `pnpm run typecheck`  | Strict typecheck of backend, tests and web without emitting |
| `pnpm run dev`        | Backend with `tsx watch` |
| `pnpm run dev:web`    | Vite dev server with HMR (proxies `/api` to the backend) |
| `pnpm start`          | Run the compiled server |
| `pnpm run mcp:stdio`  | MCP over stdio |
| `pnpm run cli`        | CLI via `tsx` (no build step), e.g. `pnpm run cli -- whoami --token $TOKEN` |
