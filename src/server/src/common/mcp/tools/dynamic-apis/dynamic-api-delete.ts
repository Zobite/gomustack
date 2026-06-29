import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDynamicApiDelete(server: McpServer) {
  server.registerTool(
    "dynamic_api_delete",
    {
      description:
        "Delete a dynamic API endpoint permanently. Removes the API, all execution logs, and sandbox files. Cannot be undone.",
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe("Dynamic API ID to delete (e.g. 'dap_xxx'). Use dynamic_api_list to find IDs"),
      },
    },
    async ({ id }) => {
      try {
        const { deleteDynamicApi } = await import(
          "../../../../modules/dynamic-apis/dynamic-api.service.js"
        );
        await deleteDynamicApi(id);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, id }, null, 2) }],
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
