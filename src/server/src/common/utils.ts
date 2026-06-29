import { nanoid } from "nanoid";

/** Generate a unique ID — 16-char nanoid */
export function genId(): string {
  return nanoid(16);
}

export function now(): number {
  return Date.now();
}

export function paginate<T>(
  allItems: T[],
  page: number,
  limit: number,
): { items: T[]; meta: { total: number; page: number; limit: number; hasMore: boolean } } {
  const total = allItems.length;
  const start = (page - 1) * limit;
  const items = allItems.slice(start, start + limit);
  return {
    items,
    meta: { total, page, limit, hasMore: start + limit < total },
  };
}

/** Resolve the public base URL for the API server.
 *  Uses API_BASE_URL env var (configured domain) or falls back to localhost. */
export function getBaseUrl(): string {
  return process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 5610}`;
}
