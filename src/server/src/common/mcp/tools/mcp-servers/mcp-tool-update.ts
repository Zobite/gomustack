import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMcpToolUpdate(server: McpServer) {
  server.registerTool(
    "mcp_tool_update",
    {
      description: "Update an existing MCP tool. All fields are optional — only provided fields are updated. Returns the updated tool.",
      inputSchema: {
        serverId: z.string().min(1).describe("MCP server ID the tool belongs to (e.g. 'mts_xxx')"),
        toolId: z.string().min(1).describe("MCP tool ID to update (e.g. 'mtl_xxx'). Use mcp_tool_list to find IDs"),
        name: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9_]+$/)
          .optional()
          .describe("New tool name (snake_case)"),
        description: z.string().max(2000).optional().describe("New description"),
        inputSchema: z.string().nullable().optional().describe("New JSON Schema string for input parameters. Set to null to clear"),
        code: z.string().optional().describe("New JavaScript code for the tool"),
        draftCode: z.string().nullable().optional().describe("Draft code for testing. Set to null to clear"),
        isActive: z.boolean().optional().describe("Enable or disable the tool"),
      },
    },
    async ({ serverId, toolId, ...data }) => {
      try {
        const { getMcpToolById, updateMcpTool, isBuiltinServer } = await import("../../../../modules/mcp-tool-servers/mcp-tool-server.service.js");
        const tool = await getMcpToolById(toolId);
        if (!tool) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Tool not found" }) }],
            isError: true,
          };
        }
        // Built-in server tools: only allow toggling isActive
        if (isBuiltinServer(serverId)) {
          const nonToggleKeys = Object.keys(data).filter((k) => k !== "isActive");
          if (nonToggleKeys.length > 0) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "Cannot edit built-in server tools — only isActive can be toggled" }) }],
              isError: true,
            };
          }
        }
        const result = await updateMcpTool(serverId, toolId, data);
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
