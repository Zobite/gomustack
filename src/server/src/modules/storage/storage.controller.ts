import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuth } from "../../common/auth/middleware.js";
import {
  createBucketBodySchema,
  updateBucketBodySchema,
  deleteBucketQuerySchema,
  listObjectsQuerySchema,
  updateObjectBodySchema,
  presignBodySchema,
  createAccessKeyBodySchema,
  updateAccessKeyBodySchema,
} from "./common/schema.js";
import type {
  CreateBucketBody,
  UpdateBucketBody,
  DeleteBucketQuery,
  ListObjectsQuery,
  UpdateObjectBody,
  PresignBody,
  CreateAccessKeyBody,
  UpdateAccessKeyBody,
} from "./common/schema.js";
import {
  createBucket,
  listBuckets,
  getBucketByName,
  updateBucket,
  deleteBucket,
  uploadObject,
  getObjectMeta,
  listObjects,
  deleteObject,
  bulkDeleteObjects,
  updateObject,
  getFilePath,
  isPubliclyAccessible,
  createPresignedUrl,
  verifyPresignedUrl,
  createAccessKey,
  listAccessKeys,
  updateAccessKey,
  deleteAccessKey,
  getStorageStats,
} from "./storage.service.js";

export function registerStorageRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // ── Bucket Routes ───────────────────────────────────────────────────────────

  // GET / — list all buckets
  r.get("/", { preHandler: [requireAuth] }, async (_req, reply) => {
    const result = await listBuckets();
    return reply.send(result);
  });

  // GET /stats — storage statistics
  r.get("/stats", { preHandler: [requireAuth] }, async (_req, reply) => {
    const stats = await getStorageStats();
    return reply.send(stats);
  });

  // POST /buckets — create bucket
  r.post(
    "/buckets",
    { preHandler: [requireAuth], schema: { body: createBucketBodySchema } },
    async (req, reply) => {
      const bucket = await createBucket(req.body as CreateBucketBody);
      return reply.code(201).send(bucket);
    },
  );

  // GET /buckets/:name — get bucket details
  r.get("/buckets/:name", { preHandler: [requireAuth] }, async (req, reply) => {
    const { name } = req.params as { name: string };
    const bucket = await getBucketByName(name);
    if (!bucket) return reply.code(400).send({ error: "not_found", message: "Bucket not found" });
    return reply.send(bucket);
  });

  // PATCH /buckets/:name — update bucket (toggle public/private)
  r.patch(
    "/buckets/:name",
    { preHandler: [requireAuth], schema: { body: updateBucketBodySchema } },
    async (req, reply) => {
      const { name } = req.params as { name: string };
      const bucket = await updateBucket(name, req.body as UpdateBucketBody);
      if (!bucket) return reply.code(400).send({ error: "not_found", message: "Bucket not found" });
      return reply.send(bucket);
    },
  );

  // DELETE /buckets/:name — delete bucket
  r.delete(
    "/buckets/:name",
    { preHandler: [requireAuth], schema: { querystring: deleteBucketQuerySchema } },
    async (req, reply) => {
      const { name } = req.params as { name: string };
      const { force } = req.query as DeleteBucketQuery;
      const result = await deleteBucket(name, force);
      return reply.send(result);
    },
  );

  // ── Object Routes ───────────────────────────────────────────────────────────

  // GET /buckets/:name/objects — list objects in bucket
  r.get(
    "/buckets/:name/objects",
    { preHandler: [requireAuth], schema: { querystring: listObjectsQuerySchema } },
    async (req, reply) => {
      const { name } = req.params as { name: string };
      const result = await listObjects(name, req.query as ListObjectsQuery);
      return reply.send(result);
    },
  );

  // POST /buckets/:name/upload — upload file
  // Supports: raw body (binary) with key in query param, or multipart/form-data
  r.post("/buckets/:name/upload", { preHandler: [requireAuth] }, async (req, reply) => {
    const { name } = req.params as { name: string };
    const queryKey = (req.query as Record<string, string>)["key"];

    // Check if this is a multipart request
    const contentType = req.headers["content-type"] ?? "";

    if (contentType.includes("multipart/form-data")) {
      // Multipart upload
      try {
        const data = await req.file();
        if (!data) {
          return reply.code(400).send({ error: "bad_request", message: "No file uploaded" });
        }
        const key = queryKey ?? data.filename;
        if (!key) {
          return reply.code(400).send({ error: "bad_request", message: "Missing key" });
        }
        const fileData = await data.toBuffer();
        const result = await uploadObject(name, key, fileData, data.mimetype);
        return reply.code(201).send(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        return reply.code(400).send({ error: "bad_request", message: msg });
      }
    }

    // Raw body upload (binary)
    const key = queryKey;
    if (!key) {
      return reply.code(400).send({ error: "bad_request", message: "Missing key query param" });
    }

    const rawBody = req.body as Buffer;
    if (!rawBody || rawBody.length === 0) {
      return reply.code(400).send({ error: "bad_request", message: "Empty body" });
    }

    const ct = contentType.split(";")[0].trim() || undefined;
    const result = await uploadObject(name, key, rawBody, ct);
    return reply.code(201).send(result);
  });

  // GET /buckets/:name/objects/:key — download file
  r.get("/buckets/:name/objects/*", { preHandler: [requireAuth] }, async (req, reply) => {
    const { name } = req.params as { name: string };
    const key = (req.params as Record<string, string>)["*"];
    if (!key) return reply.code(400).send({ error: "bad_request", message: "Missing key" });

    const meta = await getObjectMeta(name, key);
    if (!meta) return reply.code(404).send({ error: "not_found", message: "Object not found" });

    const filePath = getFilePath(name, key);
    if (!filePath) return reply.code(404).send({ error: "not_found", message: "File not found on disk" });

    const file = Bun.file(filePath);
    const buf = Buffer.from(await file.arrayBuffer());

    const inlineTypes = ["image/", "application/pdf", "text/", "video/", "audio/"];
    const disposition = inlineTypes.some((t) => meta.contentType.startsWith(t))
      ? "inline"
      : `attachment; filename="${key.split("/").pop()}"`;

    return reply
      .header("Content-Type", meta.contentType)
      .header("Content-Length", meta.size)
      .header("Content-Disposition", disposition)
      .header("ETag", `"${meta.etag}"`)
      .header("Cache-Control", "private, max-age=300, must-revalidate")
      .send(buf);
  });

  // PATCH /buckets/:name/objects/:key — update object (toggle public)
  r.patch(
    "/buckets/:name/objects/*",
    { preHandler: [requireAuth], schema: { body: updateObjectBodySchema } },
    async (req, reply) => {
      const { name } = req.params as { name: string };
      const key = (req.params as Record<string, string>)["*"];
      if (!key) return reply.code(400).send({ error: "bad_request", message: "Missing key" });

      const result = await updateObject(name, key, req.body as UpdateObjectBody);
      if (!result) return reply.code(400).send({ error: "not_found", message: "Object not found" });
      return reply.send(result);
    },
  );

  // DELETE /buckets/:name/objects/:key — delete single object
  r.delete("/buckets/:name/objects/*", { preHandler: [requireAuth] }, async (req, reply) => {
    const { name } = req.params as { name: string };
    const key = (req.params as Record<string, string>)["*"];
    if (!key) return reply.code(400).send({ error: "bad_request", message: "Missing key" });

    await deleteObject(name, key);
    return reply.send({ key, deleted: true });
  });

  // POST /buckets/:name/bulk-delete — bulk delete objects
  r.post("/buckets/:name/bulk-delete", { preHandler: [requireAuth] }, async (req, reply) => {
    const { name } = req.params as { name: string };
    const { keys } = req.body as { keys: string[] };
    if (!keys?.length) return reply.code(400).send({ error: "bad_request", message: "Missing keys" });

    const result = await bulkDeleteObjects(name, keys);
    return reply.send(result);
  });

  // POST /buckets/:name/presign/:key — create presigned URL
  r.post(
    "/buckets/:name/presign/*",
    { preHandler: [requireAuth], schema: { body: presignBodySchema } },
    async (req, reply) => {
      const { name } = req.params as { name: string };
      const key = (req.params as Record<string, string>)["*"];
      if (!key) return reply.code(400).send({ error: "bad_request", message: "Missing key" });

      const { expiresIn } = req.body as PresignBody;
      const protocol = req.headers["x-forwarded-proto"] ?? "http";
      const host = req.headers.host ?? "localhost";
      const baseUrl = `${protocol}://${host}`;

      const result = await createPresignedUrl(name, key, expiresIn, baseUrl);
      return reply.send(result);
    },
  );

  // ── Access Key Routes ───────────────────────────────────────────────────────

  // GET /access-keys — list all access keys
  r.get("/access-keys", { preHandler: [requireAuth] }, async (_req, reply) => {
    const result = await listAccessKeys();
    return reply.send(result);
  });

  // POST /access-keys — create new access key
  r.post(
    "/access-keys",
    { preHandler: [requireAuth], schema: { body: createAccessKeyBodySchema } },
    async (req, reply) => {
      const result = await createAccessKey(req.body as CreateAccessKeyBody);
      return reply.code(201).send(result);
    },
  );

  // PATCH /access-keys/:id — update access key
  r.patch(
    "/access-keys/:id",
    { preHandler: [requireAuth], schema: { body: updateAccessKeyBodySchema } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const result = await updateAccessKey(id, req.body as UpdateAccessKeyBody);
      if (!result) return reply.code(400).send({ error: "not_found", message: "Access key not found" });
      return reply.send(result);
    },
  );

  // DELETE /access-keys/:id — delete access key
  r.delete("/access-keys/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await deleteAccessKey(id);
    return reply.send(result);
  });
}

// ── Public File Routes (registered separately in module) ──────────────────────

export function registerPublicFileRoutes(app: FastifyInstance) {
  // GET /public/:bucket/:key — serve public files (no auth)
  app.get("/public/*", async (req, reply) => {
    const wildcardPath = (req.params as Record<string, string>)["*"];
    if (!wildcardPath) return reply.code(400).send({ error: "bad_request", message: "Invalid path" });

    const parts = wildcardPath.split("/");
    if (parts.length < 2) return reply.code(400).send({ error: "bad_request", message: "Invalid path" });

    const bucketName = parts[0];
    const key = parts.slice(1).join("/");

    // Check presigned URL
    const signature = (req.query as Record<string, string>)["X-Amz-Signature"];
    const expiresStr = (req.query as Record<string, string>)["expires"];

    if (signature && expiresStr) {
      const expiresAt = parseInt(expiresStr, 10);
      const isValid = await verifyPresignedUrl(bucketName, key, signature, expiresAt);
      if (!isValid) {
        return reply.code(403).send({ error: "forbidden", message: "Presigned URL expired or invalid" });
      }
    } else {
      // Check if publicly accessible
      const meta = await getObjectMeta(bucketName, key);
      if (!meta) return reply.code(404).send({ error: "not_found", message: "Object not found" });
      if (!isPubliclyAccessible(meta)) {
        return reply.code(403).send({ error: "forbidden", message: "Object is not public" });
      }
    }

    const filePath = getFilePath(bucketName, key);
    if (!filePath) return reply.code(404).send({ error: "not_found", message: "File not found" });

    const meta = await getObjectMeta(bucketName, key);
    const file = Bun.file(filePath);
    const buf = Buffer.from(await file.arrayBuffer());

    const ct = meta?.contentType ?? "application/octet-stream";
    const inlineTypes = ["image/", "application/pdf", "text/", "video/", "audio/"];
    const disposition = inlineTypes.some((t) => ct.startsWith(t))
      ? "inline"
      : `attachment; filename="${key.split("/").pop()}"`;

    return reply
      .header("Content-Type", ct)
      .header("Content-Length", buf.byteLength)
      .header("Content-Disposition", disposition)
      .header("ETag", meta?.etag ? `"${meta.etag}"` : undefined)
      .header("Cache-Control", "public, max-age=300, must-revalidate")
      .send(buf);
  });
}
