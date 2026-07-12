import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import type { FastifyInstance } from "fastify";
import {
  getConfiguration,
  setConfiguration,
  deleteConfiguration,
  batchGetConfigurations,
} from "./configuration.service.js";
import { createTestEnv, destroyTestEnv, seedUser, type TestEnv } from "../../common/test/setup.js";
import { createApp } from "../../app.js";
import { signAccess } from "../../common/auth/jwt.js";

describe("configuration.service", () => {
  let env: TestEnv;

  beforeAll(() => {
    env = createTestEnv();
  });

  afterAll(() => {
    destroyTestEnv(env);
  });

  test("set get delete and batchGet", async () => {
    const set = await setConfiguration("feature_flag", "on");
    expect(set.key).toBe("feature_flag");
    expect(set.value).toBe("on");

    const got = await getConfiguration("feature_flag");
    expect(got?.value).toBe("on");

    await setConfiguration("feature_flag", "off");
    expect((await getConfiguration("feature_flag"))?.value).toBe("off");

    const batch = await batchGetConfigurations(["feature_flag", "missing"]);
    expect(batch.feature_flag).toBe("off");
    expect(batch.missing).toBeUndefined();

    await deleteConfiguration("feature_flag");
    expect(await getConfiguration("feature_flag")).toBeNull();
  });
});

describe("configuration sensitive key access", () => {
  let env: TestEnv;
  let app: FastifyInstance;
  let adminId: string;
  let memberId: string;

  beforeAll(async () => {
    env = createTestEnv();
    const admin = await seedUser({ username: "cfgadmin", role: "admin" });
    const member = await seedUser({ username: "cfgmember", role: "member" });
    adminId = admin.id;
    memberId = member.id;
    await setConfiguration("jwt_secret", "should-not-leak-to-member");
    await setConfiguration("public_setting", "ok");
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    destroyTestEnv(env);
  });

  test("member can read non-sensitive config", async () => {
    const token = await signAccess(memberId, "member");
    const res = await app.inject({
      method: "GET",
      url: "/api/configurations/public_setting",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().value).toBe("ok");
  });

  test("member cannot read jwt_secret", async () => {
    const token = await signAccess(memberId, "member");
    const res = await app.inject({
      method: "GET",
      url: "/api/configurations/jwt_secret",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  test("admin can read jwt_secret", async () => {
    const token = await signAccess(adminId, "admin");
    const res = await app.inject({
      method: "GET",
      url: "/api/configurations/jwt_secret",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  test("member cannot batch-get sensitive keys", async () => {
    const token = await signAccess(memberId, "member");
    const res = await app.inject({
      method: "POST",
      url: "/api/configurations/batch-get",
      headers: { authorization: `Bearer ${token}` },
      payload: { keys: ["jwt_secret", "public_setting"] },
    });
    expect(res.statusCode).toBe(403);
  });
});
