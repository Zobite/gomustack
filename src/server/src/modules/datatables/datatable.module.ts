import type { FastifyInstance } from "fastify";
import { registerDatatableRoutes } from "./datatable.controller.js";

export default async function datatablesModule(app: FastifyInstance) {
  registerDatatableRoutes(app);
}

// Metadata for auto-loader
export const MODULE_PREFIX = "/api/datatables";
