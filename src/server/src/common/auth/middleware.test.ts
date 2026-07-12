import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import type { FastifyRequest } from "fastify";
import {
  apiKeyAllowsPath,
  extractAuthToken,
  requireAuth,
  requireAdmin,
  requireMcpAuth,
} from "./middleware.js";
import { createTestEnv, destroyTestEnv, seedUser, type TestEnv } from "../test/setup.js";
import { createApiKey } from "../../modules/api-keys/api-key.service.js";
import { createMcpServer, updateMcpServer } from "../../modules/mcp-tool-servers/mcp-tool-server.service.js";
import { signAccess, signRefresh } from "./jwt.js";
import { createApp } from "../../app.js";
import type { FastifyInstance } from "fastify";

function mockReq(partial: {
  headers?: Record<string, string | undefined>;
  url?: string;
  params?: Record<string, string>;
}): FastifyRequest {
  return {
    headers: partial.headers ?? {},
    url: partial.url ?? "/api/health",
    params: partial.params ?? {},
    auth: undefined,
  } as unknown as FastifyRequest;
}

describe("apiKeyAllowsPath", () => {
  test("allows wildcard", () => {
    expect(apiKeyAllowsPath(["*"], "/api/storage/buckets")).toBe(true);
  });

  test("allows module permission prefix", () => {
    expect(apiKeyAllowsPath(["storage"], "/api/storage/buckets")).toBe(true);
    expect(apiKeyAllowsPath(["storage"], "/api/kv/keys")).toBe(false);
  });

  test("allows absolute path prefix", () => {
    expect(apiKeyAllowsPath(["/api/kv"], "/api/kv/foo")).toBe(true);
    expect(apiKeyAllowsPath(["/api/kv"], "/api/kv")).toBe(true);
    expect(apiKeyAllowsPath(["/api/kv"], "/api/storage")).toBe(false);
  });

  test("ignores query string", () => {
    expect(apiKeyAllowsPath(["storage"], "/api/storage/buckets?page=1")).toBe(true);
  });
});

describe("extractAuthToken", () => {
  test("prefers X-API-Key over Bearer", () => {
    const req = mockReq({
      headers: { "x-api-key": "key-a", authorization: "Bearer key-b" },
    });
    expect(extractAuthToken(req)).toBe("key-a");
  });

  test("reads Bearer token", () => {
    const req = mockReq({ headers: { authorization: "Bearer abc" } });
    expect(extractAuthToken(req)).toBe("abc");
  });

  test("returns empty when missing", () => {
    expect(extractAuthToken(mockReq({}))).toBe("");
  });
});

describe("requireAuth / requireAdmin / requireMcpAuth", () => {
  let env: TestEnv;
  let app: FastifyInstance;
  let admin: Awaited<ReturnType<typeof seedUser>>;
  let member: Awaited<ReturnType<typeof seedUser>>;

  beforeAll(async () => {
    env = createTestEnv();
    admin = await seedUser({ username: "admin1", role: "admin" });
    member = await seedUser({ username: "member1", role: "member" });
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    destroyTestEnv(env);
  });

  test("rejects unauthenticated request", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  test("accepts JWT access token", async () => {
    const token = await signAccess(admin.id, admin.role);
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(admin.id);
  });

  test("rejects refresh token as access", async () => {
    const token = await signRefresh(admin.id, admin.role);
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });

  test("accepts API key with matching permission", async () => {
    const key = await createApiKey(admin.id, { name: "t", permissions: ["auth"] });
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { "x-api-key": key.key },
    });
    expect(res.statusCode).toBe(200);
  });

  test("rejects API key with insufficient permissions", async () => {
    const key = await createApiKey(admin.id, { name: "limited", permissions: ["storage"] });
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { "x-api-key": key.key },
    });
    expect(res.statusCode).toBe(403);
  });

  test("rejects expired API key", async () => {
    const key = await createApiKey(admin.id, {
      name: "expired",
      permissions: ["*"],
      expiresAt: Date.now() - 1000,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { "x-api-key": key.key },
    });
    expect(res.statusCode).toBe(401);
  });

  test("requireAdmin allows admin and blocks member", async () => {
    const adminToken = await signAccess(admin.id, "admin");
    const memberToken = await signAccess(member.id, "member");

    const ok = await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(ok.statusCode).toBe(200);

    const denied = await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(denied.statusCode).toBe(403);
  });

  test("requireMcpAuth accepts matching server key", async () => {
    const created = await createMcpServer({ name: "mcp-auth-test" });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/mcp/${created!.id}`,
      headers: {
        "x-api-key": created!.apiKey!,
        "mcp-session-id": "nonexistent-session",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  test("requireMcpAuth rejects server key for wrong serverId", async () => {
    const a = await createMcpServer({ name: "mcp-a" });
    const b = await createMcpServer({ name: "mcp-b" });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/mcp/${b!.id}`,
      headers: {
        "x-api-key": a!.apiKey!,
        "mcp-session-id": "nonexistent",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  test("requireMcpAuth rejects inactive server key", async () => {
    const created = await createMcpServer({ name: "mcp-inactive" });
    if (!created?.id || !created.apiKey) throw new Error("expected mcp server with api key");
    await updateMcpServer(created.id, { isActive: false });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/mcp/${created.id}`,
      headers: {
        "x-api-key": created.apiKey,
        "mcp-session-id": "nonexistent",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  test("requireAuth throws 401 when called directly without credentials", async () => {
    const req = mockReq({});
    await expect(requireAuth(req, {} as never)).rejects.toMatchObject({ statusCode: 401 });
  });

  test("requireAdmin throws 403 for non-admin", async () => {
    const token = await signAccess(member.id, "member");
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    await expect(requireAdmin(req, {} as never)).rejects.toMatchObject({ statusCode: 403 });
  });

  test("requireMcpAuth throws 401 without serverId", async () => {
    const req = mockReq({ params: {} });
    await expect(requireMcpAuth(req, {} as never)).rejects.toMatchObject({ statusCode: 401 });
  });
});
