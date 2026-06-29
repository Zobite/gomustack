import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMcpServerCreate(server: McpServer) {
  server.registerTool(
    "mcp_server_create",
    {
      description: "Create a new custom MCP server. The server will be a container for custom tools. Returns the created server with ID.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-zA-Z0-9_-]+$/)
          .describe("Server name (alphanumeric, hyphens, underscores only, e.g. 'my-tools')"),
        description: z.string().max(1000).optional().describe("Optional description of what tools this server will contain"),
      },
    },
    async ({ name, description }) => {
      try {
        const { createMcpServer } = await import("../../../../modules/mcp-tool-servers/mcp-tool-server.service.js");
        const result = await createMcpServer({ name, description });
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
