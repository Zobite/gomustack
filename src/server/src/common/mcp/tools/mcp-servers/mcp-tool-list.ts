import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMcpToolList(server: McpServer) {
  server.registerTool(
    "mcp_tool_list",
    {
      description:
        "List all tools in a specific MCP server. Returns { items, meta } with each item containing id, name, description, inputSchema, code, isActive.",
      inputSchema: {
        serverId: z.string().min(1).describe("MCP server ID (e.g. 'mts_xxx'). Use mcp_server_list to find IDs"),
        page: z.number().int().min(1).optional().describe("Page number (default: 1)"),
        limit: z.number().int().min(1).max(100).optional().describe("Items per page (default: 50, max: 100)"),
      },
    },
    async ({ serverId, page, limit }) => {
      try {
        const { getMcpServerById, listMcpTools } = await import("../../../../modules/mcp-tool-servers/mcp-tool-server.service.js");
        const svr = await getMcpServerById(serverId);
        if (!svr) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "MCP server not found" }) }],
            isError: true,
          };
        }
        const result = await listMcpTools(serverId, { page, limit });
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
