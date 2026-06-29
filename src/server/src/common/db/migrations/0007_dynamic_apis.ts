import type { Migration } from "../migrate.js";

const migration: Migration = {
  name: "0007_dynamic_apis",
  up: [
    `CREATE TABLE IF NOT EXISTS dynamic_apis (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'GET',
      path TEXT NOT NULL,
      description TEXT,
      code TEXT NOT NULL DEFAULT '',
      draft_code TEXT,
      dependencies TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      timeout INTEGER NOT NULL DEFAULT 30000,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    `CREATE UNIQUE INDEX IF NOT EXISTS idx_dynamic_apis_method_path ON dynamic_apis(method, path)`,
    `CREATE INDEX IF NOT EXISTS idx_dynamic_apis_is_active ON dynamic_apis(is_active)`,

    `CREATE TABLE IF NOT EXISTS dynamic_api_logs (
      id TEXT PRIMARY KEY,
      api_id TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      execution_time_ms INTEGER NOT NULL,
      execution_mode TEXT NOT NULL DEFAULT 'fast',
      request_headers TEXT,
      request_body TEXT,
      response_body TEXT,
      console_output TEXT,
      error TEXT,
      ip TEXT,
      created_at INTEGER NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_dynamic_api_logs_api_id ON dynamic_api_logs(api_id)`,
    `CREATE INDEX IF NOT EXISTS idx_dynamic_api_logs_created_at ON dynamic_api_logs(created_at)`,
  ],
};

export default migration;
