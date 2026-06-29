import { Database as BunSQLite } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.js";

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: BunSQLite | null = null;

export function getDb(dataDir?: string) {
  if (_db) return _db;

  const dir = dataDir ?? process.env.DATA_DIR ?? `${process.env.HOME}/.gomustack`;
  const dbPath = `${dir}/data.db`;

  _sqlite = new BunSQLite(dbPath, { create: true });

  // Enable WAL for concurrent reads
  _sqlite.exec("PRAGMA journal_mode=WAL;");
  _sqlite.exec("PRAGMA foreign_keys=ON;");
  // FTS5 support is built-in to Bun's SQLite

  _db = drizzle(_sqlite, { schema });
  return _db;
}

export function closeDb() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}

export type Db = ReturnType<typeof getDb>;
