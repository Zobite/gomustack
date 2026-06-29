import type { Migration } from "../migrate.js";

const migration: Migration = {
  name: "0010_browser_profiles",
  up: [
    `CREATE TABLE IF NOT EXISTS browser_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      user_data_dir TEXT NOT NULL,
      proxy_config TEXT,
      fingerprint_config TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      cdp_port INTEGER,
      ws_endpoint TEXT,
      pid INTEGER,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
  ],
};

export default migration;
