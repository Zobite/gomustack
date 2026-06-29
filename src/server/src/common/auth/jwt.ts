/**
 * JWT utilities — sign, verify, and secret management.
 *
 * The JWT secret is stored in the `configurations` table (key = "jwt_secret").
 * Auto-generates on first access if not found.
 */

import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getDb } from "../db/client.js";
import { configurations } from "../db/schema.js";
import { now } from "../utils.js";

const ALG = "HS256";
const ACCESS_TTL = "1h";
const REFRESH_TTL = "7d";

// ─── Secret ────────────────────────────────────────────────────────────────────

let _cached: string | null = null;

/** Get the JWT secret string. Reads from DB, caches in memory. */
export function getJwtSecret(): string {
  if (_cached) return _cached;

  const db = getDb();
  const row = db.select().from(configurations).where(eq(configurations.key, "jwt_secret")).get();

  if (row) {
    _cached = row.value;
    return _cached;
  }

  // First run — generate and persist
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString("hex");
  const ts = now();
  db.insert(configurations).values({
    key: "jwt_secret",
    value: secret,
    createdAt: ts,
    updatedAt: ts,
  }).run();

  _cached = secret;
  console.log("🔐 JWT secret generated and stored in database");
  return _cached;
}

function getSecret() {
  return new TextEncoder().encode(getJwtSecret());
}

// ─── Tokens ────────────────────────────────────────────────────────────────────

export interface TokenPayload extends JWTPayload {
  sub: string;   // userId (usr_xxxx)
  role: string;
  type: "access" | "refresh";
}

export async function signAccess(userId: string, role: string): Promise<string> {
  return new SignJWT({ sub: userId, role, type: "access" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(getSecret());
}

export async function signRefresh(userId: string, role: string): Promise<string> {
  return new SignJWT({ sub: userId, role, type: "refresh" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as TokenPayload;
}
