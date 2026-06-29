import { eq } from "drizzle-orm";
import { getDb } from "../../common/db/client.js";
import { llmProviders } from "../../common/db/schema.js";
import { genId, now } from "../../common/utils.js";
import { DEFAULT_BASE_URLS, type ProviderType } from "./common/schema.js";
import { fetchModelsFromProvider } from "./utils/fetcher.js";
import type { CreateLlmProviderBody, UpdateLlmProviderBody } from "./common/schema.js";

/** Mask an API key — show only last 4 chars */
function maskApiKey(key: string): string {
  if (!key || key.length <= 4) return key ? "••••" : "";
  return `${"•".repeat(Math.min(key.length - 4, 12))}${key.slice(-4)}`;
}

/** Resolve the effective base URL for a provider */
function resolveBaseUrl(providerType: ProviderType, baseUrl?: string | null): string | null {
  if (baseUrl) return baseUrl;
  return DEFAULT_BASE_URLS[providerType];
}

/** Normalize models — handle old format [{id,name}] → string[] */
function normalizeModels(raw: unknown[]): string[] {
  return raw.map((m) => {
    if (typeof m === "string") return m;
    if (m && typeof m === "object" && "id" in m) return String((m as { id: string }).id);
    return String(m);
  });
}

/** Format provider for API response — mask API key, parse models JSON */
function formatProvider(row: typeof llmProviders.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    providerType: row.providerType,
    apiKey: maskApiKey(row.apiKey),
    baseUrl: row.baseUrl,
    models: normalizeModels(JSON.parse(row.models) as unknown[]),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listLlmProviders() {
  const db = getDb();
  const rows = await db.select().from(llmProviders).all();
  return rows.map(formatProvider);
}

export async function getLlmProviderById(id: string) {
  const db = getDb();
  const row = await db.select().from(llmProviders).where(eq(llmProviders.id, id)).get();
  if (!row) return null;
  return formatProvider(row);
}

export async function createLlmProvider(data: CreateLlmProviderBody) {
  const db = getDb();

  // Resolve base URL
  const effectiveBaseUrl = resolveBaseUrl(data.providerType, data.baseUrl);

  // Custom provider requires base URL
  if (data.providerType === "custom" && !effectiveBaseUrl) {
    throw new Error("Base URL is required for custom providers");
  }

  // Fetch models — will throw if fails
  const models = await fetchModelsFromProvider(
    data.providerType,
    data.apiKey,
    effectiveBaseUrl,
  );

  const id = genId();
  const ts = now();

  await db.insert(llmProviders).values({
    id,
    name: data.name,
    providerType: data.providerType,
    apiKey: data.apiKey,
    baseUrl: data.baseUrl || null,
    models: JSON.stringify(models),
    createdAt: ts,
    updatedAt: ts,
  });

  return getLlmProviderById(id);
}

export async function updateLlmProvider(id: string, data: UpdateLlmProviderBody) {
  const db = getDb();

  const existing = await db.select().from(llmProviders).where(eq(llmProviders.id, id)).get();
  if (!existing) return null;

  const needsRefetch =
    (data.apiKey !== undefined && data.apiKey !== existing.apiKey) ||
    (data.baseUrl !== undefined && data.baseUrl !== existing.baseUrl);

  let modelsJson = existing.models;

  if (needsRefetch) {
    const providerType = existing.providerType as ProviderType;
    const newApiKey = data.apiKey ?? existing.apiKey;
    const newBaseUrl = data.baseUrl === undefined ? existing.baseUrl : (data.baseUrl || null);
    const effectiveBaseUrl = resolveBaseUrl(providerType, newBaseUrl);

    // Fetch models — will throw on failure (caller handles 400)
    const models = await fetchModelsFromProvider(providerType, newApiKey, effectiveBaseUrl);
    modelsJson = JSON.stringify(models);
  }

  await db.update(llmProviders).set({
    ...(data.name !== undefined && { name: data.name }),
    ...(data.apiKey !== undefined && { apiKey: data.apiKey }),
    ...(data.baseUrl !== undefined && { baseUrl: data.baseUrl || null }),
    models: modelsJson,
    updatedAt: now(),
  }).where(eq(llmProviders.id, id));

  return getLlmProviderById(id);
}

export async function deleteLlmProvider(id: string) {
  const db = getDb();
  const existing = await db.select().from(llmProviders).where(eq(llmProviders.id, id)).get();
  if (!existing) return false;
  await db.delete(llmProviders).where(eq(llmProviders.id, id));
  return true;
}

export async function refreshLlmProviderModels(id: string) {
  const db = getDb();
  const existing = await db.select().from(llmProviders).where(eq(llmProviders.id, id)).get();
  if (!existing) return null;

  const providerType = existing.providerType as ProviderType;
  const effectiveBaseUrl = resolveBaseUrl(providerType, existing.baseUrl);

  // Fetch models — will throw on failure
  const models = await fetchModelsFromProvider(providerType, existing.apiKey, effectiveBaseUrl);

  await db.update(llmProviders).set({
    models: JSON.stringify(models),
    updatedAt: now(),
  }).where(eq(llmProviders.id, id));

  return getLlmProviderById(id);
}
