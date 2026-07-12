import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  createBucket,
  uploadObject,
  getObjectMeta,
  deleteObject,
  deleteBucket,
  createPresignedUrl,
  verifyPresignedUrl,
  createAccessKey,
  verifyAccessKey,
  getSecretKeyForAccess,
  listBuckets,
} from "./storage.service.js";
import { createTestEnv, destroyTestEnv, type TestEnv } from "../../common/test/setup.js";

describe("storage.service", () => {
  let env: TestEnv;

  beforeAll(() => {
    env = createTestEnv();
  });

  afterAll(() => {
    destroyTestEnv(env);
  });

  test("createBucket and listBuckets", async () => {
    const bucket = await createBucket({ name: "docs", isPublic: false });
    expect(bucket?.name).toBe("docs");
    expect(bucket?.isPublic).toBe(false);

    const listed = await listBuckets();
    expect(listed.items.some((b) => b.name === "docs")).toBe(true);
  });

  test("rejects duplicate bucket name", async () => {
    await expect(createBucket({ name: "docs", isPublic: false })).rejects.toMatchObject({
      error: "bucket_exists",
    });
  });

  test("uploadObject and getObjectMeta", async () => {
    const data = Buffer.from("hello world");
    const uploaded = await uploadObject("docs", "folder/hello.txt", data, "text/plain");
    expect(uploaded.key).toBe("folder/hello.txt");
    expect(uploaded.size).toBe(data.byteLength);

    const meta = await getObjectMeta("docs", "folder/hello.txt");
    expect(meta?.contentType).toBe("text/plain");
  });

  test("rejects path traversal object keys", async () => {
    const data = Buffer.from("x");
    await expect(uploadObject("docs", "../escape.txt", data)).rejects.toMatchObject({
      error: "invalid_key",
    });
    await expect(uploadObject("docs", "a/../../etc/passwd", data)).rejects.toMatchObject({
      error: "invalid_key",
    });
    await expect(uploadObject("docs", "/abs.txt", data)).rejects.toMatchObject({
      error: "invalid_key",
    });
    await expect(uploadObject("docs", "nul\0byte", data)).rejects.toMatchObject({
      error: "invalid_key",
    });
  });

  test("presigned url verify succeeds and expires", async () => {
    const { url, expiresAt } = await createPresignedUrl(
      "docs",
      "folder/hello.txt",
      60,
      "http://localhost:5610",
    );
    expect(url).toContain("X-Amz-Signature=");
    const sig = new URL(url).searchParams.get("X-Amz-Signature")!;
    const expires = Math.floor(expiresAt / 1000);
    expect(await verifyPresignedUrl("docs", "folder/hello.txt", sig, expires)).toBe(true);
    expect(await verifyPresignedUrl("docs", "folder/hello.txt", sig, Math.floor(Date.now() / 1000) - 10)).toBe(false);
    expect(await verifyPresignedUrl("docs", "folder/hello.txt", "deadbeef", expires)).toBe(false);
  });

  test("access keys encrypt and verify", async () => {
    const created = await createAccessKey({ label: "ci" });
    expect(created.accessKey).toBeTruthy();
    expect(created.secretKey).toBeTruthy();

    expect(await verifyAccessKey(created.accessKey, created.secretKey)).toBe(true);
    expect(await verifyAccessKey(created.accessKey, "wrong")).toBe(false);
    expect(await getSecretKeyForAccess(created.accessKey)).toBe(created.secretKey);
  });

  test("deleteObject and force deleteBucket", async () => {
    await deleteObject("docs", "folder/hello.txt");
    expect(await getObjectMeta("docs", "folder/hello.txt")).toBeNull();

    await uploadObject("docs", "keep.txt", Buffer.from("x"));
    await expect(deleteBucket("docs")).rejects.toMatchObject({ error: "bucket_not_empty" });
    const deleted = await deleteBucket("docs", true);
    expect(deleted.deleted).toBe(true);
  });
});
