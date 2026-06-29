import type { Migration } from "../migrate.js";

const migration: Migration = {
  name: "0003_datatables",
  up: [
    `CREATE TABLE IF NOT EXISTS databases_v2 (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS dynamic_tables (
      id TEXT PRIMARY KEY,
      database_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      columns TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_dynamic_tables_database_id ON dynamic_tables(database_id)`,

    `CREATE TABLE IF NOT EXISTS dynamic_table_rows (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL REFERENCES dynamic_tables(id) ON DELETE CASCADE,
      data TEXT NOT NULL DEFAULT '{}',
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_dynamic_table_rows_table_id ON dynamic_table_rows(table_id)`,
  ],
};

export default migration;
