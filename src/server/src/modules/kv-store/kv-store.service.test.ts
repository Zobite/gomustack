import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  createVariable,
  getVariableByKey,
  updateVariable,
  deleteVariable,
  listVariables,
  cleanupExpired,
  flushAllVariables,
} from "./kv-store.service.js";
import { createTestEnv, destroyTestEnv, type TestEnv } from "../../common/test/setup.js";
import { getDb } from "../../common/db/client.js";
import { variables } from "../../common/db/schema.js";
import { eq } from "drizzle-orm";

describe("kv-store.service", () => {
  let env: TestEnv;

  beforeAll(() => {
    env = createTestEnv();
  });

  afterAll(() => {
    destroyTestEnv(env);
  });

  test("create detect types and upsert by key", async () => {
    const num = await createVariable({ key: "count", value: "42" });
    expect(num?.type).toBe("number");

    const bool = await createVariable({ key: "flag", value: "true" });
    expect(bool?.type).toBe("boolean");

    const json = await createVariable({ key: "meta", value: '{"a":1}' });
    expect(json?.type).toBe("json");

    const updated = await createVariable({ key: "count", value: "100" });
    expect(updated?.value).toBe("100");
    expect(await getVariableByKey("count")).toMatchObject({ value: "100" });
  });

  test("updateVariable and listVariables", async () => {
    const created = await createVariable({ key: "name", value: "gomu" });
    const updated = await updateVariable(created!.id, { value: "gomustack" });
    expect(updated?.value).toBe("gomustack");

    const listed = await listVariables({ search: "name", page: 1, limit: 10 });
    expect(listed.items.some((v) => v.key === "name")).toBe(true);
  });

  test("TTL expiry hides variable and cleanup deletes it", async () => {
    const created = await createVariable({ key: "temp", value: "x", ttl: 1 });
    expect(created?.expiresAt).toBeTruthy();

    const db = getDb();
    db.update(variables)
      .set({ expiresAt: Date.now() - 1000 })
      .where(eq(variables.id, created!.id))
      .run();

    expect(await getVariableByKey("temp")).toBeNull();
    const cleaned = await cleanupExpired();
    expect(cleaned.deleted).toBeGreaterThanOrEqual(1);
  });

  test("deleteVariable and flushAllVariables", async () => {
    const a = await createVariable({ key: "a", value: "1" });
    await createVariable({ key: "b", value: "2" });
    expect(await deleteVariable(a!.id)).toBe(true);

    const flushed = await flushAllVariables();
    expect(flushed.deleted).toBeGreaterThanOrEqual(1);
    expect((await listVariables({ page: 1, limit: 50 })).items.length).toBe(0);
  });
});
