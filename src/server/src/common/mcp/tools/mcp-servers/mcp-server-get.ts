import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMcpServerGet(server: McpServer) {
  server.registerTool(
    "mcp_server_get",
    {
      description: "Get a single MCP server by ID. Returns full details including name, description, type, isActive, and toolCount.",
      inputSchema: {
        id: z.string().min(1).describe("MCP server ID (e.g. 'mts_xxx'). Use mcp_server_list to find IDs"),
      },
    },
    async ({ id }) => {
      try {
        const { getMcpServerById } = await import("../../../../modules/mcp-tool-servers/mcp-tool-server.service.js");
        const result = await getMcpServerById(id);
        if (!result) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "MCP server not found" }) }],
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
