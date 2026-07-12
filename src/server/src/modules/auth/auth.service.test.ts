import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  setupService,
  getSetupStatusService,
  loginService,
  refreshService,
  changePasswordService,
  getMeService,
} from "./auth.service.js";
import { createTestEnv, destroyTestEnv, type TestEnv } from "../../common/test/setup.js";
import { verifyToken } from "../../common/auth/jwt.js";

describe("auth.service", () => {
  let env: TestEnv;

  beforeAll(() => {
    env = createTestEnv();
  });

  afterAll(() => {
    destroyTestEnv(env);
  });

  test("setup creates first admin and returns tokens", async () => {
    const statusBefore = await getSetupStatusService();
    expect(statusBefore.needsSetup).toBe(true);

    const result = await setupService({
      username: "root",
      email: "root@example.com",
      password: "Secret123!",
      name: "Root",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.user.role).toBe("admin");
    expect(result.data.access_token).toBeTruthy();
    const payload = await verifyToken(result.data.access_token);
    expect(payload.type).toBe("access");

    const statusAfter = await getSetupStatusService();
    expect(statusAfter.needsSetup).toBe(false);
  });

  test("setup rejects when already set up", async () => {
    const result = await setupService({
      username: "other",
      email: "other@example.com",
      password: "Secret123!",
      name: "Other",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("already_setup");
  });

  test("login succeeds with username and email", async () => {
    const byUser = await loginService("root", "Secret123!");
    expect(byUser).not.toBeNull();
    expect(byUser!.user.username).toBe("root");

    const byEmail = await loginService("root@example.com", "Secret123!");
    expect(byEmail).not.toBeNull();
  });

  test("login fails with wrong password", async () => {
    expect(await loginService("root", "wrong")).toBeNull();
  });

  test("refresh rotates tokens", async () => {
    const login = await loginService("root", "Secret123!");
    const refreshed = await refreshService(login!.refresh_token);
    expect(refreshed).not.toBeNull();
    expect(refreshed!.access_token).toBeTruthy();
    expect(refreshed!.refresh_token).toBeTruthy();
  });

  test("refresh rejects access token", async () => {
    const login = await loginService("root", "Secret123!");
    expect(await refreshService(login!.access_token)).toBeNull();
  });

  test("changePassword and getMe", async () => {
    const login = await loginService("root", "Secret123!");
    const me = await getMeService(login!.user.id);
    expect(me?.email).toBe("root@example.com");

    const wrong = await changePasswordService(login!.user.id, "bad", "NewPass123!");
    expect(wrong.ok).toBe(false);

    const ok = await changePasswordService(login!.user.id, "Secret123!", "NewPass123!");
    expect(ok.ok).toBe(true);

    expect(await loginService("root", "Secret123!")).toBeNull();
    expect(await loginService("root", "NewPass123!")).not.toBeNull();
  });
});
