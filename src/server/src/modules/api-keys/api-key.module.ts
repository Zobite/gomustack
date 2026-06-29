import type { FastifyInstance } from "fastify";
import { registerApiKeyRoutes } from "./api-key.controller.js";

export default async function apiKeysModule(app: FastifyInstance) {
  registerApiKeyRoutes(app);
}

// Metadata for auto-loader
export const MODULE_PREFIX = "/api/api-keys";
