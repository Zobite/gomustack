import type { FastifyInstance } from "fastify";
import { registerStorageRoutes, registerPublicFileRoutes } from "./storage.controller.js";

export default async function storageModule(app: FastifyInstance) {
  registerStorageRoutes(app);
}

// Public file routes are registered at root app level (no /api/storage prefix)
// via app.ts — exported for use there
export { registerPublicFileRoutes };

// Metadata for auto-loader
export const MODULE_PREFIX = "/api/storage";
