import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  createUser,
  getUserById,
  listUsers,
  updateUser,
  deleteUser,
  adminResetPassword,
} from "./user.service.js";
import { createTestEnv, destroyTestEnv, type TestEnv } from "../../common/test/setup.js";
import { loginService } from "../auth/auth.service.js";

describe("user.service", () => {
  let env: TestEnv;

  beforeAll(() => {
    env = createTestEnv();
  });

  afterAll(() => {
    destroyTestEnv(env);
  });

  test("create list get update user without exposing passwordHash", async () => {
    const user = await createUser({
      username: "alice",
      email: "alice@example.com",
      password: "Pass123!",
      name: "Alice",
      role: "member",
    });
    expect(user?.username).toBe("alice");
    expect((user as { passwordHash?: string } | null)?.passwordHash).toBeUndefined();

    const listed = await listUsers();
    expect(listed.some((u) => u.id === user!.id)).toBe(true);

    const updated = await updateUser(user!.id, { name: "Alice Updated" });
    expect(updated?.name).toBe("Alice Updated");
    expect((await getUserById(user!.id))?.name).toBe("Alice Updated");
  });

  test("adminResetPassword changes login password", async () => {
    const user = await createUser({
      username: "bob",
      email: "bob@example.com",
      password: "OldPass123!",
      name: "Bob",
    });
    const reset = await adminResetPassword(user!.id, "NewPass123!");
    expect(reset.ok).toBe(true);
    expect(await loginService("bob", "OldPass123!")).toBeNull();
    expect(await loginService("bob", "NewPass123!")).not.toBeNull();
  });

  test("deleteUser removes user", async () => {
    const user = await createUser({
      username: "gone",
      email: "gone@example.com",
      password: "Pass123!",
      name: "Gone",
    });
    expect(await deleteUser(user!.id)).toBe(true);
    expect(await getUserById(user!.id)).toBeUndefined();
    expect(await deleteUser(user!.id)).toBe(false);
  });
});
