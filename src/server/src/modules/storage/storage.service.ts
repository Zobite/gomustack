import { existsSync, mkdirSync, unlinkSync, readdirSync, rmdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { eq, and, like, sql, desc, asc } from "drizzle-orm";
import { getDb } from "../../common/db/client.js";
import { buckets, objects, storageAccessKeys } from "../../common/db/schema.js";
import { genId, now } from "../../common/utils.js";
import type {
  CreateBucketBody,
  UpdateBucketBody,
  ListObjectsQuery,
  UpdateObjectBody,
  CreateAccessKeyBody,
  UpdateAccessKeyBody,
} from "./common/schema.js";
import { customAlphabet } from "nanoid";

// ── Config ──────────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = Number(process.env.STORAGE_MAX_FILE_SIZE ?? 104857600); // 100MB default

export function getStoragePath(): string {
  const dataDir = process.env.DATA_DIR ?? `${process.env.HOME}/.gomustack`;
  const storagePath = process.env.STORAGE_PATH ?? join(dataDir, "storage");
  mkdirSync(storagePath, { recursive: true });
  return storagePath;
}

function bucketDir(bucketName: string): string {
  return join(getStoragePath(), bucketName);
}

function objectPath(bucketName: string, key: string): string {
  return join(bucketDir(bucketName), key);
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

async function computeEtag(data: Buffer | Uint8Array): Promise<string> {
  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(data);
  return hasher.digest("hex");
}

function detectContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    // Images
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon", bmp: "image/bmp",
    // Video
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    // Audio
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
    // Documents
    pdf: "application/pdf", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Text
    txt: "text/plain", html: "text/html", css: "text/css", js: "text/javascript",
    json: "application/json", xml: "application/xml", csv: "text/csv", md: "text/markdown",
    // Archives
    zip: "application/zip", gz: "application/gzip", tar: "application/x-tar",
    "7z": "application/x-7z-compressed", rar: "application/vnd.rar",
    // Fonts
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}

function cleanEmptyDirs(dirPath: string, stopAt: string) {
  let current = dirPath;
  while (current !== stopAt && current.startsWith(stopAt)) {
    try {
      const items = readdirSync(current);
      if (items.length > 0) break;
      rmdirSync(current);
      current = dirname(current);
    } catch {
      break;
    }
  }
}

// ── Bucket CRUD ─────────────────────────────────────────────────────────────────

export async function createBucket(data: CreateBucketBody) {
  const db = getDb();
  const id = genId();
  const ts = now();

  // Check duplicate name
  const existing = await db.select({ id: buckets.id }).from(buckets).where(eq(buckets.name, data.name)).get();
  if (existing) {
    throw Object.assign(new Error("Bucket already exists"), { statusCode: 400, error: "bucket_exists" });
  }

  // Create filesystem directory
  const dir = bucketDir(data.name);
  mkdirSync(dir, { recursive: true });

  await db.insert(buckets).values({
    id,
    name: data.name,
    isPublic: data.isPublic ? 1 : 0,
    createdAt: ts,
  });

  return getBucketByName(data.name);
}

export async function listBuckets() {
  const db = getDb();
  const rows = await db.select().from(buckets).orderBy(asc(buckets.name)).all();

  // Enrich with object counts and total size
  const enriched = [];
  for (const bucket of rows) {
    const stats = await db
      .select({
        objectCount: sql<number>`COUNT(*)`,
        totalSize: sql<number>`COALESCE(SUM(${objects.size}), 0)`,
      })
      .from(objects)
      .where(eq(objects.bucketId, bucket.id))
      .get();

    enriched.push({
      ...bucket,
      isPublic: !!bucket.isPublic,
      objectCount: stats?.objectCount ?? 0,
      totalSize: stats?.totalSize ?? 0,
    });
  }

  return { items: enriched, meta: { total: enriched.length } };
}

export async function getBucketByName(name: string) {
  const db = getDb();
  const row = await db.select().from(buckets).where(eq(buckets.name, name)).get();
  if (!row) return null;

  const stats = await db
    .select({
      objectCount: sql<number>`COUNT(*)`,
      totalSize: sql<number>`COALESCE(SUM(${objects.size}), 0)`,
    })
    .from(objects)
    .where(eq(objects.bucketId, row.id))
    .get();

  return {
    ...row,
    isPublic: !!row.isPublic,
    objectCount: stats?.objectCount ?? 0,
    totalSize: stats?.totalSize ?? 0,
  };
}

export async function getBucketById(id: string) {
  const db = getDb();
  const row = await db.select().from(buckets).where(eq(buckets.id, id)).get();
  if (!row) return null;
  return { ...row, isPublic: !!row.isPublic };
}

export async function updateBucket(name: string, data: UpdateBucketBody) {
  const db = getDb();
  const bucket = await db.select().from(buckets).where(eq(buckets.name, name)).get();
  if (!bucket) return null;

  await db.update(buckets).set({ isPublic: data.isPublic ? 1 : 0 }).where(eq(buckets.id, bucket.id));
  return getBucketByName(name);
}

export async function deleteBucket(name: string, force = false) {
  const db = getDb();
  const bucket = await db.select().from(buckets).where(eq(buckets.name, name)).get();
  if (!bucket) {
    throw Object.assign(new Error("Bucket not found"), { statusCode: 400, error: "not_found" });
  }

  // Check if bucket has objects
  const count = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(objects)
    .where(eq(objects.bucketId, bucket.id))
    .get();

  if ((count?.count ?? 0) > 0 && !force) {
    throw Object.assign(new Error("Bucket is not empty. Use force=true to delete all objects."), {
      statusCode: 400,
      error: "bucket_not_empty",
    });
  }

  // Delete all objects (DB)
  await db.delete(objects).where(eq(objects.bucketId, bucket.id));
  await db.delete(buckets).where(eq(buckets.id, bucket.id));

  // Remove directory
  const dir = bucketDir(name);
  if (existsSync(dir)) {
    // Recursive remove
    const { rmSync } = await import("node:fs");
    rmSync(dir, { recursive: true, force: true });
  }

  return { name, deleted: true };
}

// ── Object CRUD ─────────────────────────────────────────────────────────────────

export async function uploadObject(
  bucketName: string,
  key: string,
  data: Buffer | Uint8Array,
  contentType?: string,
) {
  const db = getDb();

  // Find bucket
  const bucket = await db.select().from(buckets).where(eq(buckets.name, bucketName)).get();
  if (!bucket) {
    throw Object.assign(new Error("Bucket not found"), { statusCode: 400, error: "not_found" });
  }

  // Validate size
  if (data.byteLength > MAX_FILE_SIZE) {
    throw Object.assign(new Error(`File exceeds max size of ${MAX_FILE_SIZE} bytes`), {
      statusCode: 400,
      error: "file_too_large",
    });
  }

  const etag = await computeEtag(data);
  const ct = contentType || detectContentType(key);
  const ts = now();

  // Write file to disk
  const filePath = objectPath(bucketName, key);
  mkdirSync(dirname(filePath), { recursive: true });
  await Bun.write(filePath, data);

  // Upsert metadata in DB
  const existing = await db
    .select({ id: objects.id })
    .from(objects)
    .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key)))
    .get();

  if (existing) {
    await db
      .update(objects)
      .set({ size: data.byteLength, contentType: ct, etag, updatedAt: ts })
      .where(eq(objects.id, existing.id));
    return { id: existing.id, key, etag, size: data.byteLength, contentType: ct };
  }

  const id = genId();
  await db.insert(objects).values({
    id,
    bucketId: bucket.id,
    key,
    size: data.byteLength,
    contentType: ct,
    etag,
    isPublic: 0,
    createdAt: ts,
    updatedAt: ts,
  });

  return { id, key, etag, size: data.byteLength, contentType: ct };
}

export async function getObjectMeta(bucketName: string, key: string) {
  const db = getDb();
  const bucket = await db.select().from(buckets).where(eq(buckets.name, bucketName)).get();
  if (!bucket) return null;

  const obj = await db
    .select()
    .from(objects)
    .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key)))
    .get();

  if (!obj) return null;
  return { ...obj, isPublic: !!obj.isPublic, bucketName, bucketIsPublic: !!bucket.isPublic };
}

export async function listObjects(bucketName: string, query: ListObjectsQuery) {
  const db = getDb();
  const bucket = await db.select().from(buckets).where(eq(buckets.name, bucketName)).get();
  if (!bucket) {
    throw Object.assign(new Error("Bucket not found"), { statusCode: 400, error: "not_found" });
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 100;
  const offset = (page - 1) * limit;

  const conditions = [eq(objects.bucketId, bucket.id)];
  if (query.prefix) {
    conditions.push(like(objects.key, `${query.prefix}%`));
  }
  if (query.search) {
    conditions.push(like(objects.key, `%${query.search}%`));
  }

  const where = and(...conditions);

  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(objects)
    .where(where)
    .get();
  const total = countResult?.count ?? 0;

  const rows = await db
    .select()
    .from(objects)
    .where(where)
    .orderBy(asc(objects.key))
    .limit(limit)
    .offset(offset)
    .all();

  // Handle delimiter (virtual folder listing)
  if (query.delimiter) {
    const prefix = query.prefix ?? "";
    const prefixes = new Set<string>();
    const filteredItems = [];

    for (const row of rows) {
      const suffix = row.key.slice(prefix.length);
      const delimIndex = suffix.indexOf(query.delimiter);

      if (delimIndex >= 0) {
        // This is a "folder"
        prefixes.add(prefix + suffix.slice(0, delimIndex + 1));
      } else {
        filteredItems.push({ ...row, isPublic: !!row.isPublic });
      }
    }

    return {
      items: filteredItems,
      commonPrefixes: Array.from(prefixes).sort(),
      meta: { total, page, limit, hasMore: offset + limit < total },
    };
  }

  return {
    items: rows.map((r) => ({ ...r, isPublic: !!r.isPublic })),
    commonPrefixes: [],
    meta: { total, page, limit, hasMore: offset + limit < total },
  };
}

export async function deleteObject(bucketName: string, key: string) {
  const db = getDb();
  const bucket = await db.select().from(buckets).where(eq(buckets.name, bucketName)).get();
  if (!bucket) return;

  await db
    .delete(objects)
    .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key)));

  // Remove file from disk
  const filePath = objectPath(bucketName, key);
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
    // Clean up empty directories
    cleanEmptyDirs(dirname(filePath), bucketDir(bucketName));
  } catch {
    // ignore fs errors
  }
}

export async function bulkDeleteObjects(bucketName: string, keys: string[]) {
  for (const key of keys) {
    await deleteObject(bucketName, key);
  }
  return { deleted: keys.length };
}

export async function updateObject(bucketName: string, key: string, data: UpdateObjectBody) {
  const db = getDb();
  const bucket = await db.select().from(buckets).where(eq(buckets.name, bucketName)).get();
  if (!bucket) return null;

  const obj = await db
    .select({ id: objects.id })
    .from(objects)
    .where(and(eq(objects.bucketId, bucket.id), eq(objects.key, key)))
    .get();

  if (!obj) return null;

  await db.update(objects)
    .set({ isPublic: data.isPublic ? 1 : 0, updatedAt: now() })
    .where(eq(objects.id, obj.id));

  return getObjectMeta(bucketName, key);
}

// ── File Serving ────────────────────────────────────────────────────────────────

export function getFilePath(bucketName: string, key: string): string | null {
  const filePath = objectPath(bucketName, key);
  return existsSync(filePath) ? filePath : null;
}

export function isPubliclyAccessible(objMeta: { isPublic: boolean; bucketIsPublic: boolean }): boolean {
  return objMeta.isPublic || objMeta.bucketIsPublic;
}

// ── Presigned URL ───────────────────────────────────────────────────────────────

import { getJwtSecret } from "../../common/auth/jwt.js";

const getPresignSecret = () => process.env.STORAGE_PRESIGN_SECRET ?? getJwtSecret();

export async function createPresignedUrl(
  bucketName: string,
  key: string,
  expiresIn: number,
  baseUrl: string,
): Promise<{ url: string; expiresAt: number }> {
  const meta = await getObjectMeta(bucketName, key);
  if (!meta) {
    throw Object.assign(new Error("Object not found"), { statusCode: 400, error: "not_found" });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const payload = `${bucketName}/${key}:${expiresAt}`;
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(payload + getPresignSecret());
  const signature = hasher.digest("hex");

  const url = `${baseUrl}/public/${bucketName}/${key}?X-Amz-Expires=${expiresIn}&X-Amz-Date=${Math.floor(Date.now() / 1000)}&X-Amz-Signature=${signature}&expires=${expiresAt}`;

  return { url, expiresAt: expiresAt * 1000 };
}

export async function verifyPresignedUrl(
  bucketName: string,
  key: string,
  signature: string,
  expiresAt: number,
): Promise<boolean> {
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime > expiresAt) return false;

  const payload = `${bucketName}/${key}:${expiresAt}`;
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(payload + getPresignSecret());
  const expected = hasher.digest("hex");

  return signature === expected;
}

// ── Storage Access Keys ─────────────────────────────────────────────────────────

const akAlpha = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20);
const skAlpha = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", 40);

import { encryptSecret, decryptSecret } from "../../common/s3/crypto.js";

export async function createAccessKey(data: CreateAccessKeyBody) {
  const db = getDb();
  const id = genId();
  const accessKey = akAlpha();
  const secretKey = skAlpha();

  // Store encrypted (reversible) so we can use it for S3 Sig V4 auth
  const secretKeyEnc = encryptSecret(secretKey);
  const ts = now();

  await db.insert(storageAccessKeys).values({
    id,
    accessKey,
    secretKeyHash: secretKeyEnc, // actually encrypted, not hashed
    label: data.label,
    isActive: 1,
    createdAt: ts,
  });

  // Return raw secret key only once
  return {
    id,
    accessKey,
    secretKey, // shown only once!
    label: data.label,
    isActive: true,
    createdAt: ts,
  };
}

export async function listAccessKeys() {
  const db = getDb();
  const rows = await db.select().from(storageAccessKeys).orderBy(desc(storageAccessKeys.createdAt)).all();
  return {
    items: rows.map((r) => ({ ...r, isActive: !!r.isActive })),
    meta: { total: rows.length },
  };
}

export async function updateAccessKey(id: string, data: UpdateAccessKeyBody) {
  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (data.label !== undefined) updates.label = data.label;
  if (data.isActive !== undefined) updates.isActive = data.isActive ? 1 : 0;

  await db.update(storageAccessKeys).set(updates).where(eq(storageAccessKeys.id, id));

  const row = await db.select().from(storageAccessKeys).where(eq(storageAccessKeys.id, id)).get();
  if (!row) return null;
  return { ...row, isActive: !!row.isActive };
}

export async function deleteAccessKey(id: string) {
  const db = getDb();
  await db.delete(storageAccessKeys).where(eq(storageAccessKeys.id, id));
  return { id, deleted: true };
}

export async function verifyAccessKey(accessKey: string, secretKey: string): Promise<boolean> {
  const db = getDb();
  const row = await db
    .select()
    .from(storageAccessKeys)
    .where(eq(storageAccessKeys.accessKey, accessKey))
    .get();

  if (!row || !row.isActive) return false;

  try {
    const storedSecret = decryptSecret(row.secretKeyHash);
    return storedSecret === secretKey;
  } catch {
    return false;
  }
}

/**
 * Get the raw (decrypted) secret key for an access key.
 * Used by S3 Sig V4 auth to recompute the signature.
 */
export async function getSecretKeyForAccess(accessKey: string): Promise<string | null> {
  const db = getDb();
  const row = await db
    .select({ secretKeyHash: storageAccessKeys.secretKeyHash, isActive: storageAccessKeys.isActive })
    .from(storageAccessKeys)
    .where(eq(storageAccessKeys.accessKey, accessKey))
    .get();

  if (!row || !row.isActive) return null;

  try {
    return decryptSecret(row.secretKeyHash);
  } catch {
    return null;
  }
}

// ── Storage Stats ───────────────────────────────────────────────────────────────

export async function getStorageStats() {
  const db = getDb();

  const bucketCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(buckets)
    .get();

  const objectStats = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalSize: sql<number>`COALESCE(SUM(${objects.size}), 0)`,
    })
    .from(objects)
    .get();

  return {
    bucketCount: bucketCount?.count ?? 0,
    objectCount: objectStats?.count ?? 0,
    totalSize: objectStats?.totalSize ?? 0,
  };
}
