import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuth } from "../../common/auth/middleware.js";
import { createApiKeyBodySchema } from "./common/schema.js";
import type { CreateApiKeyBody } from "./common/schema.js";
import { listApiKeys, listAllApiKeys, createApiKey, deleteApiKey } from "./api-key.service.js";

export function registerApiKeyRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET / — list API keys
  // Admin — list all. Regular user — list own.
  r.get("/", { preHandler: [requireAuth] }, async (req, reply) => {
    const isAdmin = req.auth!.role === "admin";
    const keys = isAdmin
      ? await listAllApiKeys()
      : await listApiKeys(req.auth!.userId);
    return reply.send({
      items: keys,
      meta: { total: keys.length },
    });
  });

  // POST / — create new API key
  r.post(
    "/",
    {
      preHandler: [requireAuth],
      schema: { body: createApiKeyBodySchema },
    },
    async (req, reply) => {
      const result = await createApiKey(
        req.auth!.userId,
        req.body as CreateApiKeyBody,
      );
      return reply.code(201).send(result);
    },
  );

  // DELETE /:id — revoke API key
  r.delete("/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await deleteApiKey(id, req.auth!.userId);
    if (!deleted) {
      return reply.code(400).send({ error: "not_found", message: "API key not found" });
    }
    return reply.send({ id, deleted: true });
  });
}
