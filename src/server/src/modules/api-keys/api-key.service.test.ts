import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createApiKey, listApiKeys, listAllApiKeys, deleteApiKey } from "./api-key.service.js";
import { createTestEnv, destroyTestEnv, seedUser, type TestEnv } from "../../common/test/setup.js";

describe("api-key.service", () => {
  let env: TestEnv;
  let userId: string;
  let otherId: string;

  beforeAll(async () => {
    env = createTestEnv();
    userId = (await seedUser({ username: "keyuser" })).id;
    otherId = (await seedUser({ username: "otheruser" })).id;
  });

  afterAll(() => {
    destroyTestEnv(env);
  });

  test("createApiKey returns raw key once and stores hashed", async () => {
    const created = await createApiKey(userId, { name: "ci", permissions: ["storage", "kv"] });
    expect(created.key.length).toBe(40);
    expect(created.permissions).toEqual(["storage", "kv"]);
    expect(created.userId).toBe(userId);
    expect((created as { keyHash?: string }).keyHash).toBeUndefined();
  });

  test("listApiKeys scopes to user", async () => {
    await createApiKey(otherId, { name: "other", permissions: ["*"] });
    const mine = await listApiKeys(userId);
    expect(mine.every((k) => k.userId === userId)).toBe(true);
    expect(mine.some((k) => k.name === "other")).toBe(false);

    const all = await listAllApiKeys();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  test("deleteApiKey only allows owner", async () => {
    const created = await createApiKey(userId, { name: "to-delete", permissions: ["*"] });
    expect(await deleteApiKey(created.id, otherId)).toBe(false);
    expect(await deleteApiKey(created.id, userId)).toBe(true);
    expect(await deleteApiKey(created.id, userId)).toBe(false);
  });
});
