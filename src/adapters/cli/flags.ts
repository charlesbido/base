/**
 * Minimal flag parsing shared by the CLI entrypoint and command registry. No dependency on a
 * flags library: every Camp command/query takes a flat object of named fields, and CLI flags are
 * just that object spelled with `--kebab-case` keys instead of `camelCase`.
 */

export type Flags = Record<string, string>;

/** `--foo bar`, `--foo=bar` and bare `--foo` (-> "true") all work; non-flag tokens are ignored. */
export function parseFlags(argv: string[]): Flags {
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined || !arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[arg.slice(2)] = next;
      i++;
    } else {
      flags[arg.slice(2)] = 'true';
    }
  }
  return flags;
}

/**
 * Pulls the global `--token`/`--server-url` flags (and their env var fallbacks) out of argv,
 * wherever they appear, leaving the subcommand name and its own flags behind in `rest`.
 * `--remote-url` is accepted as an alias for `--server-url`.
 */
export function parseGlobalFlags(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): { token?: string; serverUrl?: string; rest: string[] } {
  let token = env.CAMP_TOKEN;
  let serverUrl = env.CAMP_SERVER_URL;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === '--token' || arg === '-t') {
      token = argv[++i];
    } else if (arg.startsWith('--token=')) {
      token = arg.slice('--token='.length);
    } else if (arg === '--server-url' || arg === '--remote-url') {
      serverUrl = argv[++i];
    } else if (arg.startsWith('--server-url=')) {
      serverUrl = arg.slice('--server-url='.length);
    } else if (arg.startsWith('--remote-url=')) {
      serverUrl = arg.slice('--remote-url='.length);
    } else {
      rest.push(arg);
    }
  }
  return { token, serverUrl, rest };
}

export const camelToKebab = (s: string): string => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export interface ArgSpec {
  /** camelCase field name, as the domain command/query expects it. */
  field: string;
  required?: boolean;
  /** The literal string "null" sets the field to `null` instead of being parsed/omitted. */
  nullable?: boolean;
  numeric?: boolean;
  help: string;
}

export const req = (field: string, help: string): ArgSpec => ({ field, required: true, help });
export const opt = (field: string, help: string): ArgSpec => ({ field, help });
export const optNum = (field: string, help: string): ArgSpec => ({ field, numeric: true, help });
export const optNullable = (field: string, help: string): ArgSpec => ({ field, nullable: true, help });
export const optNullableNum = (field: string, help: string): ArgSpec => ({ field, nullable: true, numeric: true, help });

export interface BuildResult {
  input?: Record<string, unknown>;
  error?: string;
}

/** Maps parsed `--kebab-case` flags onto the `camelCase` input object a handler expects. */
export function buildInput(specs: ArgSpec[], flags: Flags): BuildResult {
  const input: Record<string, unknown> = {};
  for (const spec of specs) {
    const flagName = camelToKebab(spec.field);
    const raw = flags[flagName];
    if (raw === undefined) {
      if (spec.required) return { error: `missing required --${flagName}` };
      continue;
    }
    if (spec.nullable && raw === 'null') {
      input[spec.field] = null;
      continue;
    }
    if (spec.numeric) {
      const n = Number(raw);
      if (Number.isNaN(n)) return { error: `--${flagName} must be a number` };
      input[spec.field] = n;
      continue;
    }
    input[spec.field] = raw;
  }
  return { input };
}
