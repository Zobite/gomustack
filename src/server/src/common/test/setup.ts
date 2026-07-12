import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { resetJwtSecretCache } from "../auth/jwt.js";
import { users } from "../db/schema.js";
import { genId, now } from "../utils.js";

export interface TestEnv {
  dataDir: string;
}

export function createTestEnv(): TestEnv {
  const dataDir = mkdtempSync(join(tmpdir(), "gomustack-test-"));
  process.env.DATA_DIR = dataDir;
  closeDb();
  resetJwtSecretCache();
  runMigrations(dataDir);
  getDb(dataDir);
  return { dataDir };
}

export function destroyTestEnv(env: TestEnv): void {
  closeDb();
  resetJwtSecretCache();
  rmSync(env.dataDir, { recursive: true, force: true });
}

export async function seedUser(opts?: {
  username?: string;
  email?: string;
  password?: string;
  name?: string;
  role?: "admin" | "member";
}): Promise<{ id: string; username: string; email: string; password: string; role: string }> {
  const password = opts?.password ?? "TestPass123!";
  const username = opts?.username ?? `user_${genId().slice(0, 8)}`;
  const email = opts?.email ?? `${username}@example.com`;
  const name = opts?.name ?? "Test User";
  const role = opts?.role ?? "admin";
  const id = genId();
  const ts = now();
  const passwordHash = await Bun.password.hash(password);
  const db = getDb();
  db.insert(users)
    .values({ id, username, email, passwordHash, name, role, createdAt: ts, updatedAt: ts })
    .run();
  return { id, username, email, password, role };
}
