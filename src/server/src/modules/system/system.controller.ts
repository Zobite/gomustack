import type { FastifyInstance } from "fastify";
import { getCurrentVersion } from "./system.service.js";

export function registerSystemRoutes(app: FastifyInstance) {
  // GET /version — current version
  app.get("/version", async (_req, reply) => {
    return reply.send({ version: getCurrentVersion() });
  });
}
