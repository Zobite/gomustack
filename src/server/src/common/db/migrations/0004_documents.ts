import type { Migration } from "../migrate.js";

const migration: Migration = {
  name: "0004_documents",
  up: [
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL DEFAULT 'Untitled',
      icon TEXT,
      cover TEXT,
      content TEXT NOT NULL DEFAULT '[]',
      parent_id TEXT,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "order" REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON documents(parent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id)`,
  ],
};

export default migration;
