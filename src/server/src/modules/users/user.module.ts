import type { FastifyInstance } from "fastify";
import { registerUsersRoutes } from "./user.controller.js";

export default async function usersModule(app: FastifyInstance) {
  registerUsersRoutes(app);
}

// Metadata for auto-loader
export const MODULE_PREFIX = "/api/users";
