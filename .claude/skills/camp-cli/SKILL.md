---
name: camp-cli
description: Use the `camp` command-line tool to read or change data in the Camp project-collaboration app (projects, to-dos, message board, docs, schedule, Campfire chat, people, access tokens) from a terminal or script. Use when the user asks to drive Camp from the command line, automate something against Camp, or asks "how do I use the camp CLI".
---

# Camp CLI

`camp` is a third adapter over Camp's domain layer — the same commands and queries the REST API
(`api.*`) and MCP server (`mcp.*`) use, callable directly from a terminal with no server required.
It talks straight to the SQLite database (`compose.ts` -> `openCamp(dbFile)`), so it works whether
or not `pnpm run dev`/`pnpm start` is running.

Source: `src/cli.ts` (entrypoint), `src/adapters/cli/registry.ts` (command table),
`src/adapters/cli/run.ts` (dispatch/help), `src/adapters/cli/flags.ts` (flag parsing).

## Authentication: always a token

Every invocation requires a Camp **personal access token** (PAT) or session token — there is no
username/password fallback on this adapter (unlike `mcp-stdio.ts`'s `CAMP_EMAIL`/`CAMP_PASSWORD`).
Pass it either way:

```sh
camp whoami --token <token>
# or, once per shell session:
export CAMP_TOKEN=<token>
camp whoami
```

If there's no token yet, mint one through another adapter first (the CLI deliberately can't
register/login — see DECISIONS.md "Personal access tokens"):

- Web app: sign in, then Account menu -> Access tokens -> create.
- REST API: `POST api.*/access-tokens` with a session cookie/bearer token (see README).
- MCP: call the `create_access_token` tool.

A missing or invalid token exits non-zero with a clear message on stderr; never guess or fabricate
a token.

## Database selection

Defaults to `data/camp.db` (same default as the server). Override with `--db <path>` or
`CAMP_DB=<path>` — this must point at the **same database file the running server uses** if you
want changes to show up in the web app / API in the same run.

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
the field name the matching domain command/query takes (`--project-id` -> `projectId`,
`--due-date` -> `dueDate`). A flag documented as nullable accepts the literal value `null` to clear
that field (e.g. `camp update-todo --todo-id <id> --due-date null` removes the due date).

Command coverage mirrors the REST API's full CRUD surface for every v1 feature (projects, to-do
lists/to-dos/comments, message board posts/comments, docs, schedule events, Campfire, access
tokens, project membership) — it's a superset of the MCP tool list, which omits some deletes for
agent safety; a human at a terminal gets everything.

## Output and exit codes

Every command prints pretty-printed JSON: the command/query's result value to **stdout** on
success, `{"error": {...}}` to **stderr** on failure (exit code 1). A missing required flag is
caught before any domain call and also reported on stderr with a usage line. Pipe success output
through tools like `node -pe 'JSON.parse(require("fs").readFileSync(0)).id'` or `jq` to chain
commands (see examples below).

## Example: project -> to-do list -> to-do

```sh
PROJECT=$(camp create-project --name "Website redesign" | jq -r .id)
LIST=$(camp create-todo-list --project-id "$PROJECT" --name "Launch" | jq -r .id)
camp create-todo --list-id "$LIST" --title "Write homepage copy" --due-date 2026-11-01
camp list-todos --project-id "$PROJECT"
```

## Example: Campfire

```sh
camp send-campfire-message --project-id "$PROJECT" --body "Shipping the redesign today"
camp read-campfire --project-id "$PROJECT" --limit 20
```

## Symlinking `camp` onto PATH (one-time local setup)

So `camp` works from any directory without `node dist/cli.js` or a full path:

```sh
pnpm run build                       # produces dist/cli.js (executable, has a shebang)
mkdir -p ~/.local/bin                # skip if it already exists and is already on PATH
ln -sf "$(pwd)/dist/cli.js" ~/.local/bin/camp
camp whoami --token <token>          # from anywhere
```

`~/.local/bin` is a common pre-existing `PATH` entry (check with `echo $PATH | tr ':' '\n'`); use
any other directory already on `PATH` instead if preferred (e.g. `/usr/local/bin`, which may need
`sudo` on macOS). Because it's a symlink (not a copy), `pnpm run build` afterward keeps `camp`
up to date — no re-linking needed after pulling new code, only after a fresh clone or build.

To remove it: `rm ~/.local/bin/camp` (never deletes anything from the repo).
