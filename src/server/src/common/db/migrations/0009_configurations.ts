import type { Migration } from "../migrate.js";

const migration: Migration = {
  name: "0009_configurations",
  up: [
    `CREATE TABLE IF NOT EXISTS configurations (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
  ],
};

export default migration;
