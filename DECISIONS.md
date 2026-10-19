# Decisions

Judgment calls made without being able to ask. Each has a one-line rationale.

## Scope

- **Deferred: binary file uploads and attachments.** Docs are text documents only (title + markdown body), per the v1 spec.
- **Deferred: Hill Charts, Card Table/Kanban, Automatic Check-ins, email-in, third-party integrations, mobile apps, real-time push (WebSockets/SSE).** These are out of scope for v1 per the spec, so none were started.
- **Campfire uses polling (every 3 s) with an inclusive `since` cursor and client-side de-duplication by id.** Inclusive bounds can't miss two messages written in the same millisecond, and de-duplication is trivial.
- **Added edit/delete for every content type, plus to-do lists, project rename/delete and member removal.** "Fully working end to end" isn't credible if mistakes can't be undone.
- **No activity feed, notifications, search, or pagination beyond Campfire's message limit.** None are in the v1 list, and the data volumes at this scale don't need them.

## Architecture

- **One SQLite database serves both commands and queries (no separate read store).** Physically separate stores would only add sync machinery at v1 scale; CQRS is enforced in code instead (separate handlers and read models).
- **Queries return `Result<View>` like commands do, not bare data.** Reads still need authorization (`forbidden`/`not_found`), and one result shape keeps every adapter's error mapping uniform.
- **Commands return the written entity rather than just an id.** API and MCP callers almost always want the created record, and an extra read round-trip buys nothing here.
- **A `createCamp(deps)` facade binds every handler to its ports.** Adapters then depend on one object instead of wiring dozens of handlers themselves, which also makes "write a CLI adapter" a few lines of code.
- **Handlers take `Pick<CampDeps, …>` instead of the full dependency bag.** Each handler's real dependencies are visible in its signature, and tests only fake what's used.
- **Validation is a tiny hand-written `Validator` in `domain/`, not zod.** The domain stays dependency-free; zod is used only at the MCP edge, where the SDK needs schemas.
- **Added ports not listed in the spec: `SessionRepository`, `CommentRepository`, `TokenGenerator`.** Sessions, comments and unguessable tokens are distinct concerns, and folding them into other ports would blur responsibilities.
- **Authorization rule: any project member can read and write everything in the project, with three exceptions.** Only authors can edit/delete their posts and comments, only the creator can delete a project, and the creator can't be removed. This matches Basecamp's collaborative default while protecting authorship and ownership.
- **Non-members get `forbidden` (403); nonexistent ids get `not_found` (404).** That's simpler to debug than hiding existence, and ids are random UUIDs, so enumeration isn't a practical concern.
- **Cascading deletes are part of the repository port contract (implemented with SQLite `ON DELETE CASCADE`).** Deleting a project, list, to-do or post removes its dependents atomically without the domain coordinating a transaction port.
- **Comments are one table with nullable `todo_id`/`post_id` foreign keys and a CHECK that exactly one is set, not a polymorphic `parent_id`.** Real foreign keys give integrity and cascades for free.
- **An architecture test (`test/architecture.test.ts`) fails the build if `domain/` or `ports/` import anything outside themselves.** The hexagonal boundary is enforced, not just documented.

## Auth

- **`bcryptjs` (pure-JS bcrypt, cost 10) instead of native `bcrypt`.** It's the same algorithm and hash format with no second native build, which keeps the dependency surface small.
- **Opaque random session tokens (256-bit) stored in a `sessions` table, valid for 30 days, accepted as the `camp_session` HttpOnly SameSite=Lax cookie or as `Authorization: Bearer`.** Cookies serve browsers (per spec); bearer tokens serve curl, scripts and MCP clients from the same session mechanism.
- **Registration signs you in immediately.** It's the expected UX, and it's done in the HTTP adapter by calling the `login` command, so no rule is duplicated.
- **The People directory lists every account to any signed-in user, and members are added by email/id of an existing account (no invitations).** v1 is a single-organisation install, and invite emails are out of scope.
- **Passwords must be 8–72 characters.** 72 bytes is bcrypt's input limit; a longer password would be silently truncated.
- **Personal access tokens (PATs), not OAuth, for long-lived MCP/script credentials.** A 30-day Session has no recovery path for a non-browser client, but a full OAuth 2.1 authorization server is a lot of machinery for a single-tenant v1 tool and a direct deviation from "no OAuth/SSO". A PAT is additive: minted from the signed-in web app (`POST /access-tokens`), optionally never expiring, revocable, hashed at rest (SHA-256 of a 256-bit random token — high-entropy already, so no bcrypt needed) and accepted anywhere a Session bearer token is (REST API, both MCP transports) via the same `getCurrentUser` check.

## HTTP, vhosts and the frontend

- **The vhost patterns match on the first DNS label (`/^api\..+$/`), not `api.localhost` literally.** The same build works on `api.localhost`, `api.camp.example.com`, etc.
- **The REST API is also mounted at `app.*/api` (the same Express app instance, in-process), and the SPA calls that.** Under the Public Suffix List default rule, `app.localhost` and `api.localhost` are different sites, so browsers won't send a `SameSite=Lax` cookie from `api.*` on `app.*` fetches. Found during browser testing, this was the only robust fix that keeps cookie auth; `api.*` stays the canonical API for every other client.
- **CORS on `api.*` is opt-in via `CORS_ORIGINS` (default none).** Camp's own SPA doesn't need it any more, and an empty allowlist is the safe default.
- **`npm run dev` runs only the backend (serving `web/dist`); Vite HMR is a separate `npm run dev:web` that proxies `/api`.** This avoids a process-manager dependency like `concurrently` for a two-terminal workflow.
- **Frontend layout: an npm workspace at `web/` with its own `package.json` and tsconfig.** One `npm install` sets up both, while the frontend keeps its own dependencies and DOM-typed compiler settings.
- **The frontend imports the backend's read-model types (`src/domain/views.ts`) type-only.** Client and server can't drift, and since types are erased, no backend code is bundled.
- **Hand-rolled `fetch` wrapper plus a small `useAsync` hook instead of React Query; `useState` forms instead of `@mantine/form`.** It keeps the dependency surface small, and screens refetch after mutations, which is plenty at this scale.
- **"Rich-ish" text is a tiny markdown subset (headings, bold/italic/code, lists, quotes, http(s)/mailto links) rendered straight to React elements.** It avoids a markdown dependency, and because it never produces HTML strings, user content can't inject markup.
- **The schedule is an agenda list grouped by day (Upcoming/Past) with native `datetime-local` inputs, not a month-grid calendar.** It covers create/read/update/delete for events without `@mantine/dates` and `dayjs`.
- **Event times are stored as UTC ISO-8601 instants; to-do due dates are timezone-less `YYYY-MM-DD` calendar dates.** A meeting is a moment in time, while a due date is a day.
- **The Mantine theme lives in `web/src/theme.ts` (primary colour, fonts, radius, component defaults).** That's the single place to re-skin the app, as the spec asks.
- **Pinned to current major versions: Express 5, React 19, Mantine 9, Vite 8, Vitest 5, TypeScript 7, react-router 8, zod 4.** The project is new, so there's no reason to start on older majors.
- **Package manager is pnpm, not npm (the spec's default).** The user explicitly asked for pnpm as the project default; `pnpm-workspace.yaml` replaces the `workspaces` field in `package.json`, and `package-lock.json` was dropped in favor of the single root `pnpm-lock.yaml`.
- **No `packageManager` field pinning a pnpm version.** A pinned version that doesn't match the pnpm actually installed on a deployment host makes pnpm try to self-install the pinned version, which fails under restricted environments like a systemd service's sandboxed `PATH` (`spawnSync pnpm ENOENT`). Each host's own pnpm (whatever version Nix/the OS provides) is used as-is.
- **The vhost fallback (unmatched Host header) serves the `app.*` app instead of a help page.** Behind a reverse proxy or tunnel (e.g. Tailscale MagicDNS, or a host-based LB) the Host header Camp sees often isn't one we anticipated; a dead-end help page is actively unhelpful there, while falling back to the main app matches what's wanted almost every time. `api.*`/`mcp.*` are still only reached by their explicit prefixes.

## CLI

- **A fourth adapter (`adapters/cli/` + `src/cli.ts`) alongside REST and MCP: a thin REST client over `api.*`, not a direct `composeCamp(db)` binding.** An earlier version opened the SQLite file directly like `mcp-stdio.ts`, but that only works when the CLI runs on the same machine/filesystem as the server; a CLI is exactly the client that's often run elsewhere (a laptop, a CI runner) against a deployed Camp, so it needs to go over the network like curl or the web app do. It still requires a token with no email/password fallback, since it's meant to be scripted non-interactively.
- **Requires both `--server-url`/`--remote-url` (`CAMP_SERVER_URL`) and `--token`/`CAMP_TOKEN`, with no default server.** Defaulting to `localhost` would silently talk to the wrong Camp instance if one happens to be running there; forcing the server to be named makes "which Camp am I talking to" unambiguous, which matters once remote servers are in play.
- **The REST client uses `node:http`/`node:https` directly, not `fetch`.** Node's own resolver does not special-case `*.localhost` -> `127.0.0.1` the way curl and browsers do per RFC 6761 (confirmed: `fetch('http://api.localhost:PORT/...')` raises `ENOTFOUND` on a stock resolver), which would break the CLI against the exact `api.localhost`/`mcp.localhost` setup the rest of Camp documents as the default. `node:http`/`https` let the client connect to `127.0.0.1` while still sending the real `Host` header the vhost dispatcher needs, which `fetch` does not allow (it silently ignores a custom `Host` header and uses the connection target instead).
- **CLI command coverage is a superset of the MCP tool list, covering the REST API's full CRUD surface (including deletes/renames MCP omits, e.g. `delete-project`, `update-message`, `delete-todo-list`).** MCP's tool list is deliberately conservative for an agent operating semi-autonomously; a human typing commands at a terminal is trusted with everything the REST API exposes.
- **Flags are the kebab-case spelling of each command/query's camelCase input fields (`--project-id` -> `projectId`), auto-derived rather than hand-mapped per command.** One conversion rule keeps ~40 commands consistent and keeps the registry declarative (a list of field specs plus the one REST route it calls) instead of one parsing function per command.
- **A flag documented as nullable accepts the literal string `"null"` to clear that field, distinct from omitting it (which leaves the field unchanged).** This mirrors the domain's own `T | null | undefined` convention for patch-style updates (e.g. `assigneeId`), so the CLI doesn't need a separate "clear" flag per nullable field.
- **Output is always pretty-printed JSON: value to stdout on success, `{"error":...}` to stderr with exit code 1 on failure.** Scriptable and pipeable (`jq`, `node -pe`) without a `--json` flag to remember, and failure on stderr keeps stdout clean for piping.
- **No `--help`/bin framework (commander, yargs, …); flag parsing and the command table are hand-written.** Consistent with "keep the dependency surface small" for a CLI this size, and command definitions stay simple data (name, args, description, the one REST route it calls).
- **Symlinking `dist/cli.js` onto `PATH` (documented in `.claude/skills/camp-cli/SKILL.md` and the README) rather than `npm link`/a global package install.** This is a single-machine, unpublished local tool; a plain symlink needs no registry involvement and updates automatically on rebuild since it points at the built file, not a copy.
