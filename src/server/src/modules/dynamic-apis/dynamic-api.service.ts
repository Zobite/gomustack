import { eq, desc, sql, and, like, or } from "drizzle-orm";
import { getDb } from "../../common/db/client.js";
import { dynamicApis, dynamicApiLogs } from "../../common/db/schema.js";
import { genId, now, paginate } from "../../common/utils.js";
import { removeSandbox, invalidateSandboxDeps, hasNpmImports } from "../../common/sandbox/js-executor.js";
import type {
  CreateDynamicApiBody,
  UpdateDynamicApiBody,
  ListDynamicApiQuery,
  ListDynamicApiLogsQuery,
} from "./common/schema.js";

// ── List dynamic APIs ──────────────────────────────────────────────────────────

export async function listDynamicApis(query: ListDynamicApiQuery) {
  const db = getDb();
  const conditions = [];

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      or(like(dynamicApis.name, term), like(dynamicApis.path, term))
    );
  }
  if (query.method) {
    conditions.push(eq(dynamicApis.method, query.method));
  }
  if (query.status === "active") {
    conditions.push(eq(dynamicApis.isActive, 1));
  } else if (query.status === "inactive") {
    conditions.push(eq(dynamicApis.isActive, 0));
  }

  const rows = await db
    .select()
    .from(dynamicApis)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(dynamicApis.updatedAt))
    .all();

  return paginate(
    rows.map(formatApi),
    query.page,
    query.limit
  );
}

// ── Get by ID ──────────────────────────────────────────────────────────────────

export async function getDynamicApiById(id: string) {
  const db = getDb();
  const row = await db
    .select()
    .from(dynamicApis)
    .where(eq(dynamicApis.id, id))
    .get();
  if (!row) return null;
  return formatApi(row);
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createDynamicApi(
  data: CreateDynamicApiBody,
  userId: string
) {
  const db = getDb();
  const id = genId();
  const ts = now();

  // Check unique method+path
  const existing = await db
    .select({ id: dynamicApis.id })
    .from(dynamicApis)
    .where(
      and(eq(dynamicApis.method, data.method), eq(dynamicApis.path, data.path))
    )
    .get();

  if (existing) {
    throw Object.assign(
      new Error(`API endpoint ${data.method} ${data.path} already exists`),
      { statusCode: 400 }
    );
  }

  await db.insert(dynamicApis).values({
    id,
    name: data.name,
    method: data.method,
    path: data.path,
    description: data.description ?? null,
    code: data.code,
    dependencies: data.dependencies
      ? JSON.stringify(data.dependencies)
      : null,
    isActive: 1,
    isPublic: data.isPublic ? 1 : 0,
    timeout: data.timeout ?? 30000,
    createdBy: userId,
    createdAt: ts,
    updatedAt: ts,
  });

  // Invalidate route cache
  invalidateRouteCache();

  return getDynamicApiById(id);
}

// ── Update ─────────────────────────────────────────────────────────────────────

export async function updateDynamicApi(id: string, data: UpdateDynamicApiBody) {
  const db = getDb();
  const ts = now();
  const updates: Record<string, unknown> = { updatedAt: ts };

  if (data.name !== undefined) updates.name = data.name;
  if (data.method !== undefined) updates.method = data.method;
  if (data.path !== undefined) updates.path = data.path;
  if (data.description !== undefined) updates.description = data.description;
  if (data.code !== undefined) updates.code = data.code;
  if (data.draftCode !== undefined) updates.draftCode = data.draftCode;
  if (data.dependencies !== undefined) {
    updates.dependencies = data.dependencies
      ? JSON.stringify(data.dependencies)
      : null;
    // Invalidate sandbox deps cache so next execution re-installs
    invalidateSandboxDeps(id);
  }
  if (data.isActive !== undefined) updates.isActive = data.isActive ? 1 : 0;
  if (data.isPublic !== undefined) updates.isPublic = data.isPublic ? 1 : 0;
  if (data.timeout !== undefined) updates.timeout = data.timeout;

  // Check unique method+path if either changed
  if (data.method !== undefined || data.path !== undefined) {
    const current = await getDynamicApiById(id);
    if (!current) return null;

    const checkMethod = data.method ?? current.method;
    const checkPath = data.path ?? current.path;

    const duplicate = await db
      .select({ id: dynamicApis.id })
      .from(dynamicApis)
      .where(
        and(
          eq(dynamicApis.method, checkMethod),
          eq(dynamicApis.path, checkPath),
          sql`${dynamicApis.id} != ${id}`
        )
      )
      .get();

    if (duplicate) {
      throw Object.assign(
        new Error(
          `API endpoint ${checkMethod} ${checkPath} already exists`
        ),
        { statusCode: 400 }
      );
    }
  }

  await db.update(dynamicApis).set(updates).where(eq(dynamicApis.id, id));

  // Invalidate caches
  invalidateRouteCache();
  invalidateWarmInstance(id);

  return getDynamicApiById(id);
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteDynamicApi(id: string) {
  const db = getDb();

  // Delete logs
  await db.delete(dynamicApiLogs).where(eq(dynamicApiLogs.apiId, id));
  // Delete the API
  await db.delete(dynamicApis).where(eq(dynamicApis.id, id));
  // Clean up sandbox directory
  removeSandbox(id);

  // Invalidate caches
  invalidateRouteCache();
  invalidateWarmInstance(id);

  return true;
}

// ── Logs ───────────────────────────────────────────────────────────────────────

export async function listDynamicApiLogs(
  apiId: string,
  query: ListDynamicApiLogsQuery
) {
  const db = getDb();
  const conditions = [eq(dynamicApiLogs.apiId, apiId)];

  if (query.status === "success") {
    conditions.push(sql`${dynamicApiLogs.statusCode} < 400`);
  } else if (query.status === "error") {
    conditions.push(sql`${dynamicApiLogs.statusCode} >= 400`);
  }

  if (query.startDate) {
    conditions.push(sql`${dynamicApiLogs.createdAt} >= ${query.startDate}`);
  }
  if (query.endDate) {
    conditions.push(sql`${dynamicApiLogs.createdAt} <= ${query.endDate}`);
  }

  const rows = await db
    .select()
    .from(dynamicApiLogs)
    .where(and(...conditions))
    .orderBy(desc(dynamicApiLogs.createdAt))
    .all();

  return paginate(rows, query.page, query.limit);
}

export async function createDynamicApiLog(data: {
  apiId: string;
  method: string;
  path: string;
  statusCode: number;
  executionTimeMs: number;
  executionMode: "fast" | "isolated";
  requestHeaders?: string;
  requestBody?: string;
  responseBody?: string;
  consoleOutput?: string;
  error?: string;
  ip?: string;
}) {
  const db = getDb();
  const id = genId();

  await db.insert(dynamicApiLogs).values({
    id,
    apiId: data.apiId,
    method: data.method,
    path: data.path,
    statusCode: data.statusCode,
    executionTimeMs: data.executionTimeMs,
    executionMode: data.executionMode,
    requestHeaders: data.requestHeaders ?? null,
    requestBody: data.requestBody ?? null,
    responseBody: data.responseBody ?? null,
    consoleOutput: data.consoleOutput ?? null,
    error: data.error ?? null,
    ip: data.ip ?? null,
    createdAt: now(),
  });
}

// ── Route cache (warm route table) ─────────────────────────────────────────────

interface CachedRoute {
  id: string;
  method: string;
  path: string;
  pathPattern: RegExp;
  paramNames: string[];
  code: string;
  dependencies: Record<string, string> | null;
  timeout: number;
  isPublic: boolean;
}

let routeCache: CachedRoute[] | null = null;

export function invalidateRouteCache() {
  routeCache = null;
}

/**
 * Build a regex + param names from a path like /users/:id/posts/:postId
 */
function buildPathPattern(path: string): {
  pattern: RegExp;
  paramNames: string[];
} {
  const paramNames: string[] = [];
  const regexStr = path.replace(/:([^/]+)/g, (_m, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });
  return {
    pattern: new RegExp(`^${regexStr}$`),
    paramNames,
  };
}

export async function getActiveRoutes(): Promise<CachedRoute[]> {
  if (routeCache) return routeCache;

  const db = getDb();
  const rows = await db
    .select()
    .from(dynamicApis)
    .where(eq(dynamicApis.isActive, 1))
    .all();

  routeCache = rows.map((row) => {
    const { pattern, paramNames } = buildPathPattern(row.path);
    let deps: Record<string, string> | null = null;
    try {
      if (row.dependencies) deps = JSON.parse(row.dependencies);
    } catch {
      // ignore
    }
    return {
      id: row.id,
      method: row.method,
      path: row.path,
      pathPattern: pattern,
      paramNames,
      code: row.code,
      dependencies: deps,
      timeout: row.timeout,
      isPublic: row.isPublic === 1,
    };
  });

  return routeCache;
}

/**
 * Match a request method + path against active routes.
 * Returns the matched route + extracted params, or null.
 */
export async function matchRoute(
  method: string,
  requestPath: string
): Promise<{
  route: CachedRoute;
  params: Record<string, string>;
} | null> {
  const routes = await getActiveRoutes();

  // First try exact method + path match
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = route.pathPattern.exec(requestPath);
    if (match) {
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { route, params };
    }
  }

  // Check if path matches but method doesn't (405)
  for (const route of routes) {
    const match = route.pathPattern.exec(requestPath);
    if (match) {
      return null; // will be treated as 405 by caller
    }
  }

  return null;
}

/**
 * Check if path matches any route (for 405 detection)
 */
export async function pathMatchesAnyMethod(
  requestPath: string
): Promise<boolean> {
  const routes = await getActiveRoutes();
  return routes.some((r) => r.pathPattern.test(requestPath));
}

// ── Warm instance cache ────────────────────────────────────────────────────────

const warmInstances = new Map<
  string,
  { fn: Function; codeHash: string; lastUsed: number }
>();
const WARM_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateWarmInstance(apiId: string) {
  warmInstances.delete(apiId);
}

function hashCode(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    const chr = code.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

export function getWarmInstance(
  apiId: string,
  code: string
): Function | null {
  const cached = warmInstances.get(apiId);
  if (!cached) return null;

  const codeHash = hashCode(code);
  if (cached.codeHash !== codeHash) {
    warmInstances.delete(apiId);
    return null;
  }

  cached.lastUsed = Date.now();
  return cached.fn;
}

export function setWarmInstance(apiId: string, code: string, fn: Function) {
  warmInstances.set(apiId, {
    fn,
    codeHash: hashCode(code),
    lastUsed: Date.now(),
  });
}

// Cleanup expired warm instances every minute
setInterval(() => {
  const cutoff = Date.now() - WARM_TTL;
  for (const [id, instance] of warmInstances) {
    if (instance.lastUsed < cutoff) {
      warmInstances.delete(id);
    }
  }
}, 60_000);

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatApi(row: typeof dynamicApis.$inferSelect) {
  let deps: Record<string, string> | null = null;
  try {
    if (row.dependencies) deps = JSON.parse(row.dependencies);
  } catch {
    // ignore
  }
  return {
    ...row,
    isActive: row.isActive === 1,
    isPublic: row.isPublic === 1,
    dependencies: deps,
    executionMode: hasNpmImports(row.code) ? "isolated" as const : "fast" as const,
  };
}
