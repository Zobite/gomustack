/**
 * AES-256-GCM encryption utilities for storing secrets reversibly.
 * Uses the JWT secret as the encryption key.
 */

import { getJwtSecret } from "../auth/jwt.js";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  // Derive a 32-byte key from JWT secret
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(getJwtSecret());
  return Buffer.from(hasher.digest());
}

/**
 * Encrypt a plaintext string. Returns base64-encoded `iv:ciphertext:authTag`.
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(crypto.getRandomValues(new Uint8Array(IV_LENGTH)));

  // Use Node.js crypto (available in Bun)
  const { createCipheriv } = require("node:crypto");
  const cipher = createCipheriv(ALGO, key, iv);

  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: base64(iv + ciphertext + authTag)
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString("base64");
}

/**
 * Decrypt a secret previously encrypted with encryptSecret().
 */
export function decryptSecret(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

  const { createDecipheriv } = require("node:crypto");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}
