import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBrowserList(server: McpServer) {
  server.registerTool(
    "browser_list",
      {
        description: "List all browser profiles with pagination and search. Returns { items, meta } where each item contains profile id, name, status, and fingerprint info.",
        inputSchema: {
      search: z
        .string()
        .optional()
        .describe("Search by profile name (case-insensitive partial match)"),
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
        .max(100)
        .optional()
        .default(10)
        .describe("Number of items per page (1–100, default: 10)"),
        },
      },
    async ({ search, page, limit }) => {
      try {
        const { listBrowserProfiles } = await import(
          "../../../../modules/browsers/browser.service.js"
        );
        const result = await listBrowserProfiles({ search, page, limit });
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
