import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  createMcpServer,
  getMcpServerById,
  listMcpServers,
  updateMcpServer,
  deleteMcpServer,
  createMcpTool,
  listMcpTools,
  updateMcpTool,
  deleteMcpTool,
  regenerateMcpServerApiKey,
  revokeMcpServerApiKey,
  isBuiltinServer,
} from "./mcp-tool-server.service.js";
import { createTestEnv, destroyTestEnv, type TestEnv } from "../../common/test/setup.js";

describe("mcp-tool-server.service", () => {
  let env: TestEnv;
  let serverId: string;
  let rawKey: string;

  beforeAll(() => {
    env = createTestEnv();
  });

  afterAll(() => {
    destroyTestEnv(env);
  });

  test("isBuiltinServer recognizes system id", () => {
    expect(isBuiltinServer("mts_system")).toBe(true);
    expect(isBuiltinServer("other")).toBe(false);
  });

  test("createMcpServer returns apiKey once and hides hash", async () => {
    const created = await createMcpServer({
      name: "custom-tools",
      description: "test",
      extendsBuiltin: ["kv_get"],
    });
    expect(created?.name).toBe("custom-tools");
    expect(created?.apiKey).toBeTruthy();
    expect(created?.hasApiKey).toBe(true);
    expect((created as { apiKeyHash?: string } | null)?.apiKeyHash).toBeUndefined();
    if (!created?.id || !created.apiKey) throw new Error("expected mcp server with api key");
    serverId = created.id;
    rawKey = created.apiKey;

    const got = await getMcpServerById(serverId);
    expect(got?.extendsBuiltin).toEqual(["kv_get"]);
    expect((got as { apiKey?: string } | null)?.apiKey).toBeUndefined();
  });

  test("listMcpServers includes created server", async () => {
    const listed = await listMcpServers();
    expect(listed.items.some((s) => s.id === serverId)).toBe(true);
  });

  test("updateMcpServer can deactivate", async () => {
    const updated = await updateMcpServer(serverId, { isActive: false, name: "renamed" });
    expect(updated?.isActive).toBe(0);
    expect(updated?.name).toBe("renamed");
    await updateMcpServer(serverId, { isActive: true });
  });

  test("tool CRUD and unique name within server", async () => {
    const tool = await createMcpTool(serverId, {
      name: "echo",
      description: "echo tool",
      code: "return input;",
      inputSchema: '{"type":"object"}',
    });
    expect(tool?.name).toBe("echo");

    await expect(
      createMcpTool(serverId, {
        name: "echo",
        description: "dup",
        code: "return 1;",
      }),
    ).rejects.toThrow(/already exists/);

    const listed = await listMcpTools(serverId, { page: 1, limit: 10 });
    expect(listed.items.length).toBe(1);

    const updated = await updateMcpTool(serverId, tool!.id, { description: "updated" });
    expect(updated?.description).toBe("updated");

    expect(await deleteMcpTool(tool!.id)).toBe(true);
  });

  test("regenerate and revoke api key", async () => {
    const regenerated = await regenerateMcpServerApiKey(serverId);
    expect(regenerated.apiKey).toBeTruthy();
    expect(regenerated.apiKey).not.toBe(rawKey);

    await revokeMcpServerApiKey(serverId);
    const got = await getMcpServerById(serverId);
    expect(got?.hasApiKey).toBe(false);
  });

  test("deleteMcpServer cascades tools", async () => {
    await createMcpTool(serverId, {
      name: "temp",
      description: "t",
      code: "return 1;",
    });
    expect(await deleteMcpServer(serverId)).toBe(true);
    expect(await getMcpServerById(serverId)).toBeNull();
  });
});
