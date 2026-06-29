import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb } from "../../common/db/client.js";
import { apiKeys } from "../../common/db/schema.js";
import { genId } from "../../common/utils.js";
import type { CreateApiKeyBody, ApiKeyResponse, CreateApiKeyResponse } from "./common/schema.js";

/** Generate an API key — gsk_ prefix + 32 chars */
function genApiKey(): string {
  return `gsk_${nanoid(32)}`;
}

/** Hash an API key with SHA-256 (hex) */
async function hashKey(raw: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(raw);
  return hasher.digest("hex");
}

/** Map DB record → safe API response (no key hash) */
function toResponse(record: typeof apiKeys.$inferSelect): ApiKeyResponse {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    userId: record.userId,
    permissions: JSON.parse(record.permissions) as string[],
    lastUsedAt: record.lastUsedAt,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

/** List all API keys for a user (masked — no raw key) */
export async function listApiKeys(userId: string): Promise<ApiKeyResponse[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .all();

  return rows.map(toResponse);
}

/** List ALL API keys in the system (admin only) */
export async function listAllApiKeys(): Promise<ApiKeyResponse[]> {
  const db = getDb();
  const rows = await db.select().from(apiKeys).all();
  return rows.map(toResponse);
}

/** Create a new API key — returns raw key only once */
export async function createApiKey(
  userId: string,
  input: CreateApiKeyBody,
): Promise<CreateApiKeyResponse> {
  const db = getDb();
  const rawKey = genApiKey();
  const keyHash = await hashKey(rawKey);
  const prefix = rawKey.slice(0, 8); // "ltk_xxxx"
  const now = Date.now();

  const record = {
    id: genId(),
    name: input.name,
    keyHash,
    prefix,
    userId,
    permissions: JSON.stringify(input.permissions ?? ["*"]),
    expiresAt: input.expiresAt ?? null,
    createdAt: now,
    lastUsedAt: null,
  };

  await db.insert(apiKeys).values(record);

  return {
    ...toResponse(record),
    key: rawKey,
  };
}

/** Delete (revoke) an API key */
export async function deleteApiKey(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const existing = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, id))
    .get();

  if (!existing || existing.userId !== userId) return false;

  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  return true;
}
