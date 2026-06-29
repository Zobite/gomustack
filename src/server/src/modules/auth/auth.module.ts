import type { FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./auth.controller.js";

export default async function authModule(app: FastifyInstance) {
  registerAuthRoutes(app);
}

export const MODULE_PREFIX = "/api/auth";
