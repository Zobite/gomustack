import { eq } from "drizzle-orm";
import { getDb } from "../../common/db/client.js";
import { users } from "../../common/db/schema.js";
import type { InsertUser } from "../../common/db/schema.js";
import { genId, now } from "../../common/utils.js";
import type { CreateUserBody, UpdateUserBody } from "./common/schema.js";

/** Safe fields — never expose passwordHash */
const SAFE_FIELDS = {
  id: users.id,
  username: users.username,
  email: users.email,
  name: users.name,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

export async function listUsers() {
  const db = getDb();
  return db.select(SAFE_FIELDS).from(users).all();
}

export async function getUserById(id: string) {
  const db = getDb();
  return db.select(SAFE_FIELDS).from(users).where(eq(users.id, id)).get();
}

export async function createUser(data: CreateUserBody) {
  const db = getDb();
  const id = genId();
  const passwordHash = await Bun.password.hash(data.password);
  const ts = now();

  await db.insert(users).values({
    id,
    username: data.username,
    email: data.email,
    passwordHash,
    name: data.name,
    role: data.role ?? "member",
    createdAt: ts,
    updatedAt: ts,
  });

  return getUserById(id);
}

export async function updateUser(id: string, data: UpdateUserBody) {
  const db = getDb();
  const updates: Partial<InsertUser> = { updatedAt: now() };

  if (data.username) updates.username = data.username;
  if (data.email) updates.email = data.email;
  if (data.name) updates.name = data.name;
  if (data.role) updates.role = data.role;
  if (data.password) updates.passwordHash = await Bun.password.hash(data.password);

  await db.update(users).set(updates).where(eq(users.id, id));
  return getUserById(id);
}

export async function deleteUser(id: string) {
  const db = getDb();

  const target = await db.select().from(users).where(eq(users.id, id)).get();
  if (!target) return false;



  await db.delete(users).where(eq(users.id, id));
  return true;
}

/** Admin reset password for any user — no old password required */
export async function adminResetPassword(id: string, newPassword: string) {
  const db = getDb();
  const user = await db.select().from(users).where(eq(users.id, id)).get();
  if (!user) return { ok: false, reason: "not_found" as const };

  const newHash = await Bun.password.hash(newPassword);
  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: now() })
    .where(eq(users.id, id));

  return { ok: true };
}
