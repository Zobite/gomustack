import type { Migration } from "../migrate.js";

const migration: Migration = {
  name: "0002_variables",
  up: [
    `CREATE TABLE IF NOT EXISTS variable_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS variables (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'string',
      ttl INTEGER,
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_variables_project_id ON variables(project_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_variables_prj_ns_key ON variables(COALESCE(project_id, ''), key)`,
    `CREATE INDEX IF NOT EXISTS idx_variables_expires_at ON variables(expires_at)`,
  ],
};

export default migration;
