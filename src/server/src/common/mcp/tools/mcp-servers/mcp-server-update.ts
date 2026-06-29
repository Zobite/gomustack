import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMcpServerUpdate(server: McpServer) {
  server.registerTool(
    "mcp_server_update",
    {
      description:
        "Update an existing custom MCP server. All fields are optional — only provided fields are updated. Cannot update the built-in server's name.",
      inputSchema: {
        id: z.string().min(1).describe("MCP server ID (e.g. 'mts_xxx'). Use mcp_server_list to find IDs"),
        name: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-zA-Z0-9_-]+$/)
          .optional()
          .describe("New server name"),
        description: z.string().max(1000).nullable().optional().describe("New description. Set to null to clear"),
        isActive: z.boolean().optional().describe("Enable or disable the server"),
      },
    },
    async ({ id, ...data }) => {
      try {
        const { getMcpServerById, updateMcpServer, isBuiltinServer } = await import("../../../../modules/mcp-tool-servers/mcp-tool-server.service.js");
        const existing = await getMcpServerById(id);
        if (!existing) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "MCP server not found" }) }],
            isError: true,
          };
        }
        if (isBuiltinServer(id) && data.name !== undefined) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Cannot rename built-in server" }) }],
            isError: true,
          };
        }
        const result = await updateMcpServer(id, data);
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
