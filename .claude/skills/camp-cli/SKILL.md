---
name: camp-cli
description: Use the `camp` command-line tool to read or change data in the Camp project-collaboration app (projects, to-dos, message board, docs, schedule, Campfire chat, people, access tokens) from a terminal or script. Use when the user asks to drive Camp from the command line, automate something against Camp, or asks "how do I use the camp CLI".
---

# Camp CLI

`camp` is a thin REST client over Camp's `api.*` vhost — the exact same HTTP API curl or the web
app talks to. It has no local database access and makes no assumption the server is on the same
machine; every invocation is a real network call.

Source: `src/cli.ts` (entrypoint), `src/adapters/cli/registry.ts` (command table, one REST route
per command), `src/adapters/cli/httpClient.ts` (the HTTP transport), `src/adapters/cli/run.ts`
(dispatch/help), `src/adapters/cli/flags.ts` (flag parsing).

## Two required globals: server URL and token

Every invocation needs **both**:

```sh
camp whoami --server-url http://api.localhost:3000 --token <token>
# or, once per shell session:
export CAMP_SERVER_URL=http://api.localhost:3000
export CAMP_TOKEN=<token>
camp whoami
```

`--remote-url` is accepted as an alias for `--server-url`. There is no default server — passing
neither flag nor setting the env var is a clear error, not a silent fallback to `localhost`,
since "which Camp instance am I talking to" should never be a guess. The URL is always the `api.*`
vhost's base, e.g. `http://api.localhost:3000` locally or `https://api.example.com` for a deployed
instance.

## Authentication: always a token

There is no username/password fallback on this adapter (unlike `mcp-stdio.ts`'s
`CAMP_EMAIL`/`CAMP_PASSWORD`) — pass a Camp personal access token (PAT) or session token. If
there's no token yet, mint one through another adapter first (the CLI deliberately can't
register/login — see DECISIONS.md "Personal access tokens"):

- Web app: sign in, then Account menu -> Access tokens -> create.
- REST API: `POST api.*/access-tokens` with a session cookie/bearer token (see README).
- MCP: call the `create_access_token` tool.

A missing or invalid token, or an unreachable server, exits non-zero with a clear message on
stderr; never guess or fabricate either value.

## Running it

- **Built**: after `pnpm run build`, either `camp <command> ...` (if symlinked onto `PATH`, see
  below) or `node dist/cli.js <command> ...`.
- **Unbuilt / dev**: `pnpm run cli -- <command> ...` (runs `src/cli.ts` directly via `tsx`, no
  build step — useful while iterating).

## Discovering commands

The command table is the source of truth — don't hardcode a copy of it elsewhere, just ask the
CLI:

```sh
camp help                  # every command, one line each
camp help create-todo      # that command's exact flags, required/optional/nullable
```

Every command is `camp <kebab-case-name> [--flag value ...]`. Flags are the kebab-case spelling of
the field name the matching REST endpoint takes (`--project-id` -> `projectId`, `--due-date` ->
`dueDate`). A flag documented as nullable accepts the literal value `null` to clear that field
(e.g. `camp update-todo --todo-id <id> --due-date null` removes the due date).

Command coverage mirrors the REST API's full CRUD surface for every v1 feature (projects, to-do
lists/to-dos/comments, message board posts/comments, docs, schedule events, Campfire, access
tokens, project membership) — it's a superset of the MCP tool list, which omits some deletes for
agent safety; a human at a terminal gets everything.

## Output and exit codes

Every command prints pretty-printed JSON: the REST response body to **stdout** on success (status
2xx), `{"error": {...}}` to **stderr** on failure (exit code 1) — exactly what the server returned,
including validation `fields`. A missing required flag is caught before any network call and also
reported on stderr with a usage line. An unreachable server reports `{"error":{"code":"unreachable",...}}`.
Pipe success output through tools like `node -pe 'JSON.parse(require("fs").readFileSync(0)).id'`
or `jq` to chain commands (see examples below).

## Example: project -> to-do list -> to-do

```sh
export CAMP_SERVER_URL=http://api.localhost:3000
PROJECT=$(camp create-project --name "Website redesign" --token "$TOKEN" | jq -r .id)
LIST=$(camp create-todo-list --project-id "$PROJECT" --name "Launch" --token "$TOKEN" | jq -r .id)
camp create-todo --list-id "$LIST" --title "Write homepage copy" --due-date 2026-11-01 --token "$TOKEN"
camp list-todos --project-id "$PROJECT" --token "$TOKEN"
```

## Example: Campfire

```sh
camp send-campfire-message --project-id "$PROJECT" --body "Shipping the redesign today" --token "$TOKEN"
camp read-campfire --project-id "$PROJECT" --limit 20 --token "$TOKEN"
```

## A note on `*.localhost`

The server's own default setup uses `api.localhost`/`app.localhost`/`mcp.localhost` for vhost
dispatch (RFC 6761: these always resolve to loopback). curl and browsers honour that automatically;
Node's own DNS resolver often does not (`ENOTFOUND api.localhost`). The CLI works around this
itself — it connects to `127.0.0.1` for any `*.localhost` host while still sending the real `Host`
header the server's vhost dispatch needs — so `--server-url http://api.localhost:3000` just works
with no `/etc/hosts` edits, the same as it does for curl.

## Symlinking `camp` onto PATH (one-time local setup)

So `camp` works from any directory without `node dist/cli.js` or a full path:

```sh
pnpm run build                       # produces dist/cli.js (executable, has a shebang)
mkdir -p ~/.local/bin                # skip if it already exists and is already on PATH
ln -sf "$(pwd)/dist/cli.js" ~/.local/bin/camp
camp whoami --server-url http://api.localhost:3000 --token <token>   # from anywhere
```

`~/.local/bin` is a common pre-existing `PATH` entry (check with `echo $PATH | tr ':' '\n'`); use
any other directory already on `PATH` instead if preferred (e.g. `/usr/local/bin`, which may need
`sudo` on macOS). Because it's a symlink (not a copy), `pnpm run build` afterward keeps `camp`
up to date — no re-linking needed after pulling new code, only after a fresh clone or build.

To remove it: `rm ~/.local/bin/camp` (never deletes anything from the repo).
