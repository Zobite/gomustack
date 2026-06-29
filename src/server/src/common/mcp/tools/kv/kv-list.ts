import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerKvList(server: McpServer) {
  server.registerTool(
    "kv_list",
      {
        description: "List all stored variables with pagination and search. Returns { items, total, page, totalPages }.",
        inputSchema: {
      search: z
        .string()
        .optional()
        .describe("Filter variables by key name (case-insensitive partial match)"),
      page: z
        .number()
        .int()
        .min(1)
        .optional()
        .default(1)
        .describe("Page number for pagination (1-indexed, default: 1)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .default(50)
        .describe("Number of items per page (1–200, default: 50)"),
        },
      },
    async ({ search, page, limit }) => {
      try {
        const { listVariables } = await import(
          "../../../../modules/kv-store/kv-store.service.js"
        );
        const result = await listVariables({ search, page, limit });
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
