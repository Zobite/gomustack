import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMcpToolGet(server: McpServer) {
  server.registerTool(
    "mcp_tool_get",
    {
      description:
        "Get a single MCP tool by ID. Returns full details including name, description, inputSchema (JSON Schema), code, draftCode, and isActive status.",
      inputSchema: {
        toolId: z.string().min(1).describe("MCP tool ID (e.g. 'mtl_xxx'). Use mcp_tool_list to find IDs"),
      },
    },
    async ({ toolId }) => {
      try {
        const { getMcpToolById } = await import("../../../../modules/mcp-tool-servers/mcp-tool-server.service.js");
        const result = await getMcpToolById(toolId);
        if (!result) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Tool not found" }) }],
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
