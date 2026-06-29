import type { FastifyInstance } from "fastify";
import { registerConfigurationRoutes } from "./configuration.controller.js";

export default async function configurationsModule(app: FastifyInstance) {
  registerConfigurationRoutes(app);
}

export const MODULE_PREFIX = "/api/configurations";
