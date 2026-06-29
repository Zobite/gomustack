import { eq, inArray } from "drizzle-orm";
import { getDb } from "../../common/db/client.js";
import { configurations } from "../../common/db/schema.js";
import { now } from "../../common/utils.js";
import type { ConfigurationResponse } from "./common/schema.js";

function format(row: typeof configurations.$inferSelect): ConfigurationResponse {
  return {
    key: row.key,
    value: row.value,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getConfiguration(key: string): Promise<ConfigurationResponse | null> {
  const db = getDb();
  const row = await db.select().from(configurations).where(eq(configurations.key, key)).get();
  return row ? format(row) : null;
}

export async function setConfiguration(key: string, value: string): Promise<ConfigurationResponse> {
  const db = getDb();
  const ts = now();

  const existing = await db.select().from(configurations).where(eq(configurations.key, key)).get();

  if (existing) {
    await db
      .update(configurations)
      .set({ value, updatedAt: ts })
      .where(eq(configurations.key, key));
  } else {
    await db.insert(configurations).values({ key, value, createdAt: ts, updatedAt: ts });
  }

  const row = await db.select().from(configurations).where(eq(configurations.key, key)).get();
  return format(row!);
}

export async function deleteConfiguration(key: string): Promise<void> {
  const db = getDb();
  await db.delete(configurations).where(eq(configurations.key, key));
}

export async function batchGetConfigurations(keys: string[]): Promise<Record<string, string>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(configurations)
    .where(inArray(configurations.key, keys))
    .all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
