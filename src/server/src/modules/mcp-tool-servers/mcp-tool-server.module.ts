import type { FastifyInstance } from "fastify";
import { registerMcpServerRoutes, registerMcpToolRoutes } from "./mcp-tool-server.controller.js";

export default async function mcpToolServersModule(app: FastifyInstance) {
  registerMcpServerRoutes(app);
  app.register(
    async (sub) => {
      registerMcpToolRoutes(sub);
    },
    { prefix: "/:id/tools" },
  );
}

// Metadata for auto-loader
export const MODULE_PREFIX = "/api/mcp-tool-servers";
