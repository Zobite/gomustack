import type { FastifyInstance } from "fastify";
import { registerSystemRoutes } from "./system.controller.js";

export default async function systemModule(app: FastifyInstance) {
  registerSystemRoutes(app);
}

// Metadata for auto-loader
export const MODULE_PREFIX = "/api/system";
