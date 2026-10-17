# Camp — a Basecamp-style project collaboration tool

A from-scratch clone of Basecamp's core feature set. This file is the spec — follow it precisely rather than improvising architecture. Implement start to finish: scaffold, build every feature below, write tests, make it actually run, commit to git as you go. Nobody is available to answer clarifying questions during this run — if something in this spec is ambiguous, make the simplest reasonable choice, document it in a `DECISIONS.md` file at the repo root with a one-line rationale, and keep moving. Do not stop to ask questions.

## Feature scope (v1 — intentionally trimmed from Basecamp's full surface)

Build these, fully working end to end (UI + API + persistence):

1. **Projects** — top-level container. Name, description, list of member Users.
2. **To-dos** — To-do lists within a Project; To-do items within a list (title, description, assignee, due date, done/not-done). Comments on individual to-do items.
3. **Message Board** — Posts within a Project (title + rich-ish text body). Comments on posts.
4. **Docs** — Simple text documents within a Project (title + body). No binary file upload in v1 (explicitly deferred — note it in DECISIONS.md).
5. **Schedule** — Calendar events within a Project (title, start date/time, end date/time, optional description).
6. **Campfire** (chat) — One persistent chat room per Project. Messages with author + timestamp. Polling-based (the client re-fetches on an interval) — no WebSockets, keep it boring.
7. **People** — User accounts. Simple session-cookie auth (bcrypt-hashed passwords, no OAuth/SSO). A User can belong to multiple Projects.

Explicitly OUT of scope for v1 (list in DECISIONS.md as deferred, do not build): Hill Charts, Card Table/Kanban view, Automatic Check-ins, real file/attachment uploads, email-in, third-party integrations, mobile apps, real-time push (WebSockets/SSE).

## Architecture — non-negotiable

**CQRS**: every write goes through a **Command** (validated, mutates state) producing a result; every read goes through a **Query** (read-only, shaped for its specific view). Commands and Queries are separate code paths — do not have a single "service" class that mutates and reads. Backed by **one SQLite database** for v1 (not physically separate read/write stores — that's a deliberate simplification at this scale; note it in DECISIONS.md).

**Ports and adapters (hexagonal)**:
```
src/
  domain/           <- pure business logic. NO imports of express, better-sqlite3, or any I/O library here.
    commands/       <- one command handler per file: (deps, input) => Result
    queries/        <- one query handler per file: (deps, input) => data
    types.ts         <- domain types (Project, Todo, Post, Doc, Event, Message, User, ...)
  ports/            <- TypeScript interfaces only. e.g. ProjectRepository, TodoRepository,
                       UserRepository, PostRepository, DocRepository, ScheduleRepository,
                       ChatRepository, Clock, IdGenerator, PasswordHasher.
                       Command/query handlers depend ONLY on these interfaces, injected.
  adapters/
    sqlite/         <- concrete implementations of every repository port, backed by better-sqlite3.
    http/           <- Express REST API adapter. Translates HTTP <-> Commands/Queries. No business
                       logic here beyond request parsing/response shaping.
    mcp/            <- MCP server adapter (@modelcontextprotocol/sdk). Exposes the SAME commands/
                       queries as MCP tools (e.g. list_projects, create_todo, post_message). This
                       is the proof that ports-and-adapters is real: MCP and HTTP both call the
                       identical domain layer, never duplicating logic.
  server.ts         <- wires everything: constructs adapters, injects into domain handlers,
                       sets up the three vhosts, starts one HTTP server.
web/                <- React + TypeScript frontend (separate from the backend's src/, own package.json
                       or own workspace — your call, document the choice).
```

**Why this matters**: a reviewer should be able to delete `adapters/http` and `adapters/mcp` entirely, write a third adapter (say, a CLI), and have it work with zero changes to `domain/` or `ports/`. If that's not true, the architecture is wrong — fix it before moving on, don't just note it and continue.

## Stack — keep it boring, do not deviate

- **Backend**: Node.js, TypeScript (strict mode), Express. No NestJS, no heavyweight DI framework, no GraphQL.
- **Database**: SQLite via `better-sqlite3` (synchronous, simple — not `sqlite3`, not an ORM like Prisma/TypeORM; hand-written SQL in the sqlite adapters is fine and preferred — keep the dependency surface small).
- **Frontend**: React + TypeScript. Vite for the dev server/build (boring, fast, standard — not Next.js, this isn't server-rendered).
- **Design system**: Mantine (`@mantine/core`, `@mantine/hooks`) — off-the-shelf, themeable via `MantineProvider` + a theme object (pick a reasonable default theme, make it easy to swap colors/fonts in one place). Do not hand-roll a component library.
- **MCP**: `@modelcontextprotocol/sdk`, stdio or streamable-http transport — expose project data/actions as MCP tools on the `mcp.*` vhost.
- **Testing**: Vitest. At minimum: unit tests for every command/query handler in `domain/` (these should be fast and need no real I/O — use an in-memory fake implementing each port for tests), plus a couple of integration tests hitting the real SQLite adapters.
- **Vhosts**: ONE Express/HTTP server process, using the `vhost` npm package (or equivalent Host-header dispatch middleware) to route by `Host` header to three sub-applications:
  - `app.*` → serves the built React app (static files) in production, or proxies/serves dev build
  - `api.*` → the REST API adapter
  - `mcp.*` → the MCP server adapter (if using streamable-http transport; if stdio is simpler for v1, implement stdio as the primary MCP transport and still expose a thin HTTP wrapper on `mcp.*` that's documented clearly)
  - Bind all three to the SAME port (vhost dispatches by `Host` header, not port) — document in the README that `app.localhost`/`api.localhost`/`mcp.localhost` resolve to 127.0.0.1 automatically on most systems (RFC 6761), no `/etc/hosts` edit needed, and give exact `curl -H "Host: api.localhost" ...` examples for anyone whose resolver doesn't do that.

## Definition of done

- `npm install && npm run build` succeeds with zero TypeScript errors (strict mode) in both backend and frontend.
- `npm test` passes.
- The server actually starts (`npm run dev` or equivalent) and you can `curl` the API vhost to create a Project, add a Todo, and read it back.
- The MCP adapter actually works — demonstrate with at least one successful tool call (document the exact command used to verify it in the README).
- A `DECISIONS.md` at the repo root lists every judgment call you made without asking, one line each, with a one-sentence rationale.
- Commit to git incrementally as you go (meaningful commits, not one giant commit at the end) — this is a local-only repo, no remote configured, do not attempt to push.
