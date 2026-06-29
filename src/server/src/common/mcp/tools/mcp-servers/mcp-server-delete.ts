import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMcpServerDelete(server: McpServer) {
  server.registerTool(
    "mcp_server_delete",
    {
      description: "Delete a custom MCP server permanently. This will also delete all tools belonging to the server. Cannot delete the built-in server.",
      inputSchema: {
        id: z.string().min(1).describe("MCP server ID to delete (e.g. 'mts_xxx'). Use mcp_server_list to find IDs"),
      },
    },
    async ({ id }) => {
      try {
        const { getMcpServerById, deleteMcpServer, isBuiltinServer } = await import("../../../../modules/mcp-tool-servers/mcp-tool-server.service.js");
        if (isBuiltinServer(id)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Cannot delete built-in server" }) }],
            isError: true,
          };
        }
        const existing = await getMcpServerById(id);
        if (!existing) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "MCP server not found" }) }],
            isError: true,
          };
        }
        await deleteMcpServer(id);
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
