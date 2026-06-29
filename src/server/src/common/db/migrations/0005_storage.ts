import type { Migration } from "../migrate.js";

const migration: Migration = {
  name: "0005_storage",
  up: [
    `CREATE TABLE IF NOT EXISTS buckets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS objects (
      id TEXT PRIMARY KEY,
      bucket_id TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      etag TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    `CREATE UNIQUE INDEX IF NOT EXISTS idx_objects_bucket_key ON objects(bucket_id, key)`,
    `CREATE INDEX IF NOT EXISTS idx_objects_bucket_id ON objects(bucket_id)`,

    `CREATE TABLE IF NOT EXISTS storage_access_keys (
      id TEXT PRIMARY KEY,
      access_key TEXT NOT NULL UNIQUE,
      secret_key_hash TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )`,
  ],
};

export default migration;
