import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuth } from "../../common/auth/middleware.js";
import { SetConfigurationBody, BatchGetConfigurationsBody } from "./common/schema.js";
import {
  getConfiguration,
  setConfiguration,
  deleteConfiguration,
  batchGetConfigurations,
} from "./configuration.service.js";

export function registerConfigurationRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET /:key — Get single configuration value
  r.get("/:key", { preHandler: [requireAuth] }, async (req, reply) => {
    const { key } = req.params as { key: string };
    const config = await getConfiguration(key);
    if (!config) {
      return reply.code(404).send({ error: "not_found", message: "Configuration not found" });
    }
    return reply.send(config);
  });

  // PUT /:key — Upsert a configuration value
  r.put(
    "/:key",
    { preHandler: [requireAuth], schema: { body: SetConfigurationBody } },
    async (req, reply) => {
      const { key } = req.params as { key: string };
      const config = await setConfiguration(key, req.body.value);
      return reply.send(config);
    },
  );

  // DELETE /:key — Delete a configuration
  r.delete("/:key", { preHandler: [requireAuth] }, async (req, reply) => {
    const { key } = req.params as { key: string };
    await deleteConfiguration(key);
    return reply.send({ ok: true });
  });

  // POST /batch-get — Get multiple configurations by keys
  r.post(
    "/batch-get",
    { preHandler: [requireAuth], schema: { body: BatchGetConfigurationsBody } },
    async (req, reply) => {
      const values = await batchGetConfigurations(req.body.keys);
      return reply.send({ values });
    },
  );
}
