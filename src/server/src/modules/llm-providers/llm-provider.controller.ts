import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAdmin } from "../../common/auth/middleware.js";
import {
  createLlmProviderBodySchema,
  updateLlmProviderBodySchema,
} from "./common/schema.js";
import type {
  CreateLlmProviderBody,
  UpdateLlmProviderBody,
} from "./common/schema.js";
import {
  listLlmProviders,
  getLlmProviderById,
  createLlmProvider,
  updateLlmProvider,
  deleteLlmProvider,
  refreshLlmProviderModels,
} from "./llm-provider.service.js";

export function registerLlmProviderRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET / — List all providers
  r.get("/", { preHandler: [requireAdmin] }, async (_req, reply) => {
    const providers = await listLlmProviders();
    return reply.send({
      items: providers,
      meta: { total: providers.length },
    });
  });

  // GET /:id — Get single provider
  r.get("/:id", { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const provider = await getLlmProviderById(id);
    if (!provider) {
      return reply.code(400).send({ error: "not_found", message: "Provider not found" });
    }
    return reply.send(provider);
  });

  // POST / — Create provider
  r.post(
    "/",
    {
      preHandler: [requireAdmin],
      schema: { body: createLlmProviderBodySchema },
    },
    async (req, reply) => {
      try {
        const provider = await createLlmProvider(req.body as CreateLlmProviderBody);
        return reply.code(201).send(provider);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create provider";
        return reply.code(400).send({ error: "bad_request", message });
      }
    },
  );

  // PUT /:id — Update provider
  r.put(
    "/:id",
    {
      preHandler: [requireAdmin],
      schema: { body: updateLlmProviderBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        const provider = await updateLlmProvider(id, req.body as UpdateLlmProviderBody);
        if (!provider) {
          return reply.code(400).send({ error: "not_found", message: "Provider not found" });
        }
        return reply.send(provider);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update provider";
        return reply.code(400).send({ error: "bad_request", message });
      }
    },
  );

  // DELETE /:id — Delete provider
  r.delete("/:id", { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await deleteLlmProvider(id);
    if (!deleted) {
      return reply.code(400).send({ error: "not_found", message: "Provider not found" });
    }
    return reply.send({ id, deleted: true });
  });

  // POST /:id/refresh-models — Re-fetch models
  r.post("/:id/refresh-models", { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const provider = await refreshLlmProviderModels(id);
      if (!provider) {
        return reply.code(400).send({ error: "not_found", message: "Provider not found" });
      }
      return reply.send(provider);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to refresh models";
      return reply.code(400).send({ error: "bad_request", message });
    }
  });
}
