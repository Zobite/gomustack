import type { FastifyInstance } from "fastify";
import { registerKvStoreRoutes } from "./kv-store.controller.js";

export default async function kvStoreModule(app: FastifyInstance) {
  registerKvStoreRoutes(app);
}

// Metadata for auto-loader
export const MODULE_PREFIX = "/api/kv-store";
