import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { signAccess, signRefresh, verifyToken, getJwtSecret, resetJwtSecretCache } from "./jwt.js";
import { createTestEnv, destroyTestEnv, type TestEnv } from "../test/setup.js";

describe("jwt", () => {
  let env: TestEnv;

  beforeAll(() => {
    env = createTestEnv();
  });

  afterAll(() => {
    destroyTestEnv(env);
  });

  test("getJwtSecret generates and caches secret", () => {
    resetJwtSecretCache();
    const a = getJwtSecret();
    const b = getJwtSecret();
    expect(a.length).toBeGreaterThan(32);
    expect(a).toBe(b);
  });

  test("signAccess and verifyToken round-trip", async () => {
    const token = await signAccess("usr_test", "admin");
    const payload = await verifyToken(token);
    expect(payload.sub).toBe("usr_test");
    expect(payload.role).toBe("admin");
    expect(payload.type).toBe("access");
  });

  test("signRefresh produces refresh type", async () => {
    const token = await signRefresh("usr_test", "member");
    const payload = await verifyToken(token);
    expect(payload.type).toBe("refresh");
  });

  test("verifyToken rejects tampered token", async () => {
    const token = await signAccess("usr_test", "admin");
    await expect(verifyToken(token.slice(0, -4) + "xxxx")).rejects.toBeDefined();
  });
});
