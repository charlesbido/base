/**
 * CLI dispatch: resolves a subcommand, builds its input from flags, runs it, and shapes output.
 * No business logic here, same as the HTTP and MCP adapters — it only translates process.argv
 * into exactly one Camp command or query call.
 */
import type { Camp, UserSummary } from '../../domain/index.js';
import { buildInput, camelToKebab, parseFlags } from './flags.js';
import { type CliCommand, registry } from './registry.js';

const KIND_LABEL: Record<CliCommand['kind'], string> = { read: 'read', write: 'write', delete: 'delete' };

function usageLine(command: CliCommand): string {
  const flags = command.args
    .map((spec) => {
      const flag = `--${camelToKebab(spec.field)} <value${spec.nullable ? '|null' : ''}>`;
      return spec.required ? flag : `[${flag}]`;
    })
    .join(' ');
  return `camp ${command.name}${flags ? ` ${flags}` : ''}`;
}

export function printCommandHelp(command: CliCommand): void {
  console.log(`${command.name} — ${command.description} (${KIND_LABEL[command.kind]})\n`);
  console.log(`Usage: ${usageLine(command)}\n`);
  if (command.args.length > 0) {
    console.log('Flags:');
    for (const spec of command.args) {
      const flag = `--${camelToKebab(spec.field)}`;
      const tags = [spec.required ? 'required' : 'optional', spec.nullable ? 'nullable' : null].filter(Boolean).join(', ');
      console.log(`  ${flag.padEnd(24)} ${spec.help} (${tags})`);
    }
  }
}

export function printHelp(commandName?: string): void {
  if (commandName) {
    const command = registry.find((c) => c.name === commandName);
    if (!command) {
      console.error(`Unknown command "${commandName}". Run "camp help" to list commands.`);
      return;
    }
    printCommandHelp(command);
    return;
  }
  console.log('camp — CLI for Camp, backed by the same commands/queries as the REST API and MCP server.\n');
  console.log('Usage: camp <command> [--flag value ...] --token <token>');
  console.log('       camp help <command>              (flags for one command)\n');
  console.log('Commands:');
  for (const command of registry) {
    console.log(`  ${command.name.padEnd(24)} ${command.description}`);
  }
}

/** Runs one subcommand; returns the process exit code. */
export async function runCli(camp: Camp, actor: UserSummary, argv: string[]): Promise<number> {
  const [name, ...rest] = argv;
  const command = registry.find((c) => c.name === name);
  if (!command) {
    console.error(`Unknown command "${name ?? ''}". Run "camp help" to list commands.`);
    return 1;
  }
  if (rest.includes('--help') || rest.includes('-h')) {
    printCommandHelp(command);
    return 0;
  }

  const flags = parseFlags(rest);
  const built = buildInput(command.args, flags);
  if (built.error) {
    console.error(`camp ${command.name}: ${built.error}`);
    console.error(`Usage: ${usageLine(command)}`);
    return 1;
  }

  const result = await command.run(camp, actor, built.input ?? {});
  if (result.ok) {
    console.log(JSON.stringify(result.value, null, 2));
    return 0;
  }
  console.error(JSON.stringify({ error: result.error }, null, 2));
  return 1;
}
