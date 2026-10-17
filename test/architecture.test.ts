/**
 * Guards the hexagonal boundary: domain/ and ports/ must not depend on any adapter, framework,
 * or I/O library. If this fails, fix the dependency — don't loosen the test.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', 'src');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : path.endsWith('.ts') ? [path] : [];
  });
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

describe.each(['domain', 'ports'])('src/%s', (layer) => {
  it('imports only from domain/ and ports/ (no adapters, frameworks, or I/O)', () => {
    const violations: string[] = [];
    for (const file of filesUnder(join(root, layer))) {
      for (const spec of importsOf(file)) {
        const allowed =
          spec.startsWith('.') &&
          !spec.includes('/adapters/') &&
          !spec.includes('../server') &&
          !spec.includes('../compose');
        if (!allowed) violations.push(`${relative(root, file)} -> ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('src/ports', () => {
  it('contains only type declarations', () => {
    for (const file of filesUnder(join(root, 'ports'))) {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(code, relative(root, file)).not.toMatch(/\b(class|function|const|let|var|new)\b/);
    }
  });
});
