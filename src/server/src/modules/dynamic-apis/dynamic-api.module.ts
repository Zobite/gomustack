import type { FastifyInstance } from "fastify";
import { registerDynamicApiRoutes } from "./dynamic-api.controller.js";

export default async function dynamicApisModule(app: FastifyInstance) {
  registerDynamicApiRoutes(app);
}

// Metadata for auto-loader
export const MODULE_PREFIX = "/api/dynamic-apis";
