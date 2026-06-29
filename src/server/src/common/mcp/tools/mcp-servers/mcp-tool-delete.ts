import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMcpToolDelete(server: McpServer) {
  server.registerTool(
    "mcp_tool_delete",
    {
      description: "Delete an MCP tool permanently. Cannot delete tools from the built-in server.",
      inputSchema: {
        serverId: z.string().min(1).describe("MCP server ID the tool belongs to (e.g. 'mts_xxx')"),
        toolId: z.string().min(1).describe("MCP tool ID to delete (e.g. 'mtl_xxx'). Use mcp_tool_list to find IDs"),
      },
    },
    async ({ serverId, toolId }) => {
      try {
        const { getMcpToolById, deleteMcpTool, isBuiltinServer } = await import("../../../../modules/mcp-tool-servers/mcp-tool-server.service.js");
        if (isBuiltinServer(serverId)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Cannot delete built-in server tools" }) }],
            isError: true,
          };
        }
        const tool = await getMcpToolById(toolId);
        if (!tool) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Tool not found" }) }],
            isError: true,
          };
        }
        await deleteMcpTool(toolId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, toolId }, null, 2) }],
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
