import type { FastifyInstance } from "fastify";
import { registerLlmProviderRoutes } from "./llm-provider.controller.js";

export default async function llmProvidersModule(app: FastifyInstance) {
  registerLlmProviderRoutes(app);
}

// Metadata for auto-loader
export const MODULE_PREFIX = "/api/llm-providers";
