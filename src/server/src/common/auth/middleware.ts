import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "./jwt.js";
import { getDb } from "../db/client.js";
import { apiKeys, mcpToolServers } from "../db/schema.js";
import { eq } from "drizzle-orm";

export interface AuthContext {
  userId: string;
  role: string;
  via: "jwt" | "apikey" | "mcp_server_key";
  permissions?: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

/** Hash an API key with SHA-256 (hex) */
async function hashApiKey(raw: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(raw);
  return hasher.digest("hex");
}

function looksLikeJwt(token: string): boolean {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

function parsePermissions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((p) => typeof p === "string")) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

/** Check whether an API key's permissions allow the request path */
export function apiKeyAllowsPath(permissions: string[], url: string): boolean {
  if (permissions.includes("*")) return true;
  const path = url.split("?")[0];
  return permissions.some((p) => {
    if (p.startsWith("/")) {
      const prefix = p.endsWith("/") ? p.slice(0, -1) : p;
      return path === prefix || path.startsWith(`${prefix}/`);
    }
    return path.startsWith(`/api/${p}`) || path.startsWith(`/api/${p}/`);
  });
}

/** Extract raw credential for downstream SDK calls (X-API-Key or Bearer) */
export function extractAuthToken(req: FastifyRequest): string {
  const xApiKey = req.headers["x-api-key"];
  if (xApiKey && typeof xApiKey === "string" && xApiKey.length > 0) {
    return xApiKey;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return "";
}

/** Resolve auth from platform API key only (not MCP server keys) */
async function resolveApiKey(rawKey: string): Promise<AuthContext | null> {
  const keyHash = await hashApiKey(rawKey);
  const db = getDb();

  const record = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .get();

  if (!record) return null;

  if (record.expiresAt && record.expiresAt < Date.now()) return null;

  const permissions = parsePermissions(record.permissions);
  if (permissions.length === 0) return null;

  db.update(apiKeys)
    .set({ lastUsedAt: Date.now() })
    .where(eq(apiKeys.id, record.id))
    .run();

  return { userId: record.userId, role: "member", via: "apikey", permissions };
}

/** Resolve auth from MCP server key — requires matching serverId */
async function resolveMcpServerKey(
  rawKey: string,
  serverId: string,
): Promise<AuthContext | null> {
  const keyHash = await hashApiKey(rawKey);
  const db = getDb();

  const server = await db
    .select()
    .from(mcpToolServers)
    .where(eq(mcpToolServers.apiKeyHash, keyHash))
    .get();

  if (!server) return null;
  if (server.id !== serverId) return null;
  if (!server.isActive) return null;

  return { userId: "usr_mcp_system", role: "member", via: "mcp_server_key" };
}

/**
 * Extract platform auth from:
 *   1. X-API-Key: <api-key>
 *   2. Authorization: Bearer <jwt | api-key>
 *
 * MCP server keys are intentionally NOT accepted here — use requireMcpAuth.
 */
export async function resolveAuth(req: FastifyRequest): Promise<AuthContext | null> {
  const xApiKey = req.headers["x-api-key"];
  if (xApiKey && typeof xApiKey === "string") {
    return resolveApiKey(xApiKey);
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  if (looksLikeJwt(token)) {
    try {
      const payload = await verifyToken(token);
      if (payload.type !== "access") return null;
      return { userId: payload.sub!, role: payload.role, via: "jwt" };
    } catch {
      return null;
    }
  }

  return resolveApiKey(token);
}

/** Fastify preHandler — requires authenticated request */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  const auth = await resolveAuth(req);
  if (!auth) {
    const err = new Error("Authentication required") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  if (auth.via === "apikey" && auth.permissions) {
    if (!apiKeyAllowsPath(auth.permissions, req.url)) {
      const err = new Error("Insufficient API key permissions") as Error & { statusCode: number };
      err.statusCode = 403;
      throw err;
    }
  }

  req.auth = auth;
}

/** Fastify preHandler — requires admin role */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (req.auth!.role !== "admin") {
    const err = new Error("Admin access required") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Fastify preHandler for MCP endpoints — MCP server key (scoped to :serverId)
 * or platform JWT / API key auth.
 */
export async function requireMcpAuth(req: FastifyRequest, reply: FastifyReply) {
  const { serverId } = req.params as { serverId?: string };
  if (!serverId) {
    const err = new Error("Authentication required") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  const xApiKey = req.headers["x-api-key"];
  if (xApiKey && typeof xApiKey === "string") {
    const mcpAuth = await resolveMcpServerKey(xApiKey, serverId);
    if (mcpAuth) {
      req.auth = mcpAuth;
      return;
    }
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7);
    if (rawKey && !looksLikeJwt(rawKey)) {
      const mcpAuth = await resolveMcpServerKey(rawKey, serverId);
      if (mcpAuth) {
        req.auth = mcpAuth;
        return;
      }
    }
  }

  await requireAuth(req, reply);
}
