import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerMcpServerList(server: McpServer) {
  server.registerTool(
    "mcp_server_list",
    {
      description:
        "List all MCP servers (built-in + custom) with tool counts. Returns { items, meta } where each item has id, name, description, type (builtin|custom), isActive, toolCount.",
      inputSchema: {},
    },
    async () => {
      try {
        const { listMcpServers } = await import("../../../../modules/mcp-tool-servers/mcp-tool-server.service.js");
        const result = await listMcpServers();
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
