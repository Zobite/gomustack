import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "./jwt.js";
import { getDb } from "../db/client.js";
import { apiKeys, mcpToolServers } from "../db/schema.js";
import { eq } from "drizzle-orm";

export interface AuthContext {
  userId: string;
  role: string;
  via: "jwt" | "apikey" | "mcp_server_key";
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

/** Resolve auth from API key (ltk_xxx) */
async function resolveApiKey(rawKey: string): Promise<AuthContext | null> {
  if (!rawKey.startsWith("ltk_")) return null;

  const keyHash = await hashApiKey(rawKey);
  const db = getDb();

  const record = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .get();

  if (!record) return null;

  // Check expiration
  if (record.expiresAt && record.expiresAt < Date.now()) return null;

  // Update last_used_at (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: Date.now() })
    .where(eq(apiKeys.id, record.id))
    .run();

  return { userId: record.userId, role: "member", via: "apikey" };
}

/** Resolve auth from MCP server key (msk_xxx) — validates serverId match */
async function resolveMcpServerKey(
  rawKey: string,
  serverId?: string,
): Promise<AuthContext | null> {
  if (!rawKey.startsWith("msk_")) return null;

  const keyHash = await hashApiKey(rawKey);
  const db = getDb();

  const server = await db
    .select()
    .from(mcpToolServers)
    .where(eq(mcpToolServers.apiKeyHash, keyHash))
    .get();

  if (!server) return null;

  // Key must belong to the requested server (when serverId is provided)
  if (serverId && server.id !== serverId) return null;

  // Server must be active
  if (!server.isActive) return null;

  return { userId: "usr_mcp_system", role: "member", via: "mcp_server_key" };
}

/**
 * Extract auth from:
 *   1. Authorization: Bearer <jwt>
 *   2. Authorization: Bearer <api-key>  (prefix "ltk_")
 *   3. X-API-Key: <api-key>
 */
export async function resolveAuth(req: FastifyRequest): Promise<AuthContext | null> {
  // 1. Check X-API-Key header first
  const xApiKey = req.headers["x-api-key"];
  if (xApiKey && typeof xApiKey === "string") {
    if (xApiKey.startsWith("msk_")) {
      return resolveMcpServerKey(xApiKey);
    }
    return resolveApiKey(xApiKey);
  }

  // 2. Check Authorization: Bearer ...
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  // 3. If token starts with ltk_ → API key
  if (token.startsWith("ltk_")) {
    return resolveApiKey(token);
  }

  // 4. If token starts with msk_ → MCP server key (internal calls from tool executor)
  if (token.startsWith("msk_")) {
    return resolveMcpServerKey(token);
  }

  // 5. Otherwise → JWT
  try {
    const payload = await verifyToken(token);
    if (payload.type !== "access") return null;
    return { userId: payload.sub!, role: payload.role, via: "jwt" };
  } catch {
    return null;
  }
}

/** Fastify preHandler — requires authenticated request */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const auth = await resolveAuth(req);
  if (!auth) {
    const err = new Error("Authentication required") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
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
 * Fastify preHandler for MCP endpoints — supports MCP server key (msk_) in addition
 * to standard JWT / API key auth. Extracts serverId from route params.
 */
export async function requireMcpAuth(req: FastifyRequest, reply: FastifyReply) {
  const { serverId } = req.params as { serverId?: string };

  // 1. Try MCP server key from X-API-Key header
  const xApiKey = req.headers["x-api-key"];
  if (xApiKey && typeof xApiKey === "string" && xApiKey.startsWith("msk_") && serverId) {
    const auth = await resolveMcpServerKey(xApiKey, serverId);
    if (auth) {
      req.auth = auth;
      return;
    }
  }

  // 2. Try MCP server key from Authorization: Bearer msk_...
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer msk_") && serverId) {
    const rawKey = authHeader.slice(7);
    const auth = await resolveMcpServerKey(rawKey, serverId);
    if (auth) {
      req.auth = auth;
      return;
    }
  }

  // 3. Fallback to standard auth (JWT / ltk_ API key)
  const auth = await resolveAuth(req);
  if (!auth) {
    const err = new Error("Authentication required") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  req.auth = auth;
}

