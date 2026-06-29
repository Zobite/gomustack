import { Database as BunSQLite } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { migrations } from "./migrations/index.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Migration {
  /** Unique name, e.g. "0001_users". Used as the tracking key. */
  name: string;
  /** Array of SQL statements executed in order within a transaction. */
  up: string[];
}

// ─── Migration tracking table ─────────────────────────────────────────────────

const MIGRATIONS_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS _migrations (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL UNIQUE,
    applied_at INTEGER NOT NULL
  )
`;

// ─── Runner ───────────────────────────────────────────────────────────────────

export function runMigrations(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });
  const sqlite = new BunSQLite(`${dataDir}/data.db`, { create: true });
  sqlite.exec("PRAGMA journal_mode=WAL;");
  sqlite.exec("PRAGMA foreign_keys=ON;");

  // Ensure tracking table exists
  sqlite.exec(MIGRATIONS_TABLE_DDL);

  // Get already-applied migration names
  const applied = new Set(
    sqlite
      .query<{ name: string }, []>("SELECT name FROM _migrations")
      .all()
      .map((r) => r.name)
  );

  // Determine pending migrations (preserve order, skip already applied)
  const pending = migrations.filter((m) => !applied.has(m.name));

  if (pending.length === 0) {
    console.log("[DB] No pending migrations.");
    sqlite.close();
    return;
  }

  // Apply pending migrations inside a single transaction
  sqlite.transaction(() => {
    for (const m of pending) {
      for (const sql of m.up) {
        sqlite.exec(sql);
      }
      sqlite.exec(
        `INSERT INTO _migrations(name, applied_at) VALUES ('${m.name}', ${Date.now()})`
      );
      console.log(`[DB]   ✓ ${m.name}`);
    }
  })();

  console.log(`[DB] Applied ${pending.length} migration(s).`);
  sqlite.close();
}

// ─── CLI: bun src/common/db/migrate.ts ────────────────────────────────────────

if (import.meta.main) {
  const dataDir =
    process.env.DATA_DIR ?? `${process.env.HOME}/.gomustack`;
  runMigrations(dataDir);
}
