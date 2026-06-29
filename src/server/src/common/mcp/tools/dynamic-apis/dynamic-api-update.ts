import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDynamicApiUpdate(server: McpServer) {
  server.registerTool(
    "dynamic_api_update",
    {
      description:
        "Update an existing dynamic API endpoint. All fields are optional — only provided fields are updated. Returns the updated API.",
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe("Dynamic API ID (e.g. 'dap_xxx'). Use dynamic_api_list to find IDs"),
        name: z
          .string()
          .min(1)
          .max(255)
          .optional()
          .describe("New name"),
        method: z
          .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
          .optional()
          .describe("New HTTP method"),
        path: z
          .string()
          .min(1)
          .max(500)
          .optional()
          .describe("New path (must start with /)"),
        description: z
          .string()
          .max(2000)
          .nullable()
          .optional()
          .describe("New description. Set to null to clear"),
        code: z
          .string()
          .optional()
          .describe("New handler code"),
        isActive: z
          .boolean()
          .optional()
          .describe("Enable or disable the endpoint"),
        isPublic: z
          .boolean()
          .optional()
          .describe("Make endpoint public or private"),
        timeout: z
          .number()
          .int()
          .min(1000)
          .max(300000)
          .optional()
          .describe("New execution timeout in milliseconds"),
      },
    },
    async ({ id, ...data }) => {
      try {
        const { updateDynamicApi } = await import(
          "../../../../modules/dynamic-apis/dynamic-api.service.js"
        );
        const result = await updateDynamicApi(id, data);
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
