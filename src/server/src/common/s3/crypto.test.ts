import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { encryptSecret, decryptSecret } from "./crypto.js";
import { createTestEnv, destroyTestEnv, type TestEnv } from "../test/setup.js";

describe("s3/crypto", () => {
  let env: TestEnv;

  beforeAll(() => {
    env = createTestEnv();
  });

  afterAll(() => {
    destroyTestEnv(env);
  });

  test("encryptSecret and decryptSecret round-trip", () => {
    const plain = "super-secret-key-value";
    const enc = encryptSecret(plain);
    expect(enc).not.toBe(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  test("same plaintext produces different ciphertext", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same");
    expect(decryptSecret(b)).toBe("same");
  });

  test("tampered ciphertext fails decrypt", () => {
    const enc = encryptSecret("payload");
    const buf = Buffer.from(enc, "base64");
    buf[buf.length - 1] ^= 0xff;
    expect(() => decryptSecret(buf.toString("base64"))).toThrow();
  });
});
