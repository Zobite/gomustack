import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDynamicApiList(server: McpServer) {
  server.registerTool(
    "dynamic_api_list",
    {
      description:
        "List all dynamic API endpoints with optional filtering. Returns { items, meta } with each item containing id, name, method, path, code, isActive, and execution mode.",
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe("Search by name or path (case-insensitive partial match)"),
        method: z
          .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
          .optional()
          .describe("Filter by HTTP method"),
        status: z
          .enum(["active", "inactive"])
          .optional()
          .describe("Filter by status"),
      },
    },
    async ({ search, method, status }) => {
      try {
        const { listDynamicApis } = await import(
          "../../../../modules/dynamic-apis/dynamic-api.service.js"
        );
        const result = await listDynamicApis({ search, method, status, page: 1, limit: 100 });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Internal error";
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
          isError: true,
        };
      }
    },
  );
}
