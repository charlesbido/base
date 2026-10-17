/**
 * Composition root shared by every entrypoint (HTTP server, MCP stdio): concrete adapters in,
 * a fully-wired Camp out. This is the only place that knows which adapter backs which port.
 */
import { openDatabase, sqliteRepositories, type Db } from './adapters/sqlite/index.js';
import { BcryptPasswordHasher, CryptoTokenGenerator, SystemClock, UuidGenerator } from './adapters/system/index.js';
import { createCamp, type Camp } from './domain/index.js';

export function composeCamp(db: Db): Camp {
  return createCamp({
    ...sqliteRepositories(db),
    clock: new SystemClock(),
    ids: new UuidGenerator(),
    tokens: new CryptoTokenGenerator(),
    passwords: new BcryptPasswordHasher(),
  });
}

export function openCamp(dbFile: string): { db: Db; camp: Camp } {
  const db = openDatabase(dbFile);
  return { db, camp: composeCamp(db) };
}

export const DEFAULT_DB_FILE = process.env.CAMP_DB ?? 'data/camp.db';
