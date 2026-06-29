import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDynamicApiGet(server: McpServer) {
  server.registerTool(
    "dynamic_api_get",
    {
      description:
        "Get a dynamic API endpoint by ID. Returns full details including code, path, method, dependencies, and execution mode.",
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe("Dynamic API ID (e.g. 'dap_xxx'). Use dynamic_api_list to find IDs"),
      },
    },
    async ({ id }) => {
      try {
        const { getDynamicApiById } = await import(
          "../../../../modules/dynamic-apis/dynamic-api.service.js"
        );
        const result = await getDynamicApiById(id);
        if (!result) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "API not found" }) }],
            isError: true,
          };
        }
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
