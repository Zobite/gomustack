import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMcpToolCreate(server: McpServer) {
  server.registerTool(
    "mcp_tool_create",
    {
      description: "Create a new tool in a custom MCP server. The tool runs JavaScript code in a sandbox. " + "Cannot add tools to the built-in server.",
      inputSchema: {
        serverId: z.string().min(1).describe("MCP server ID to add the tool to (e.g. 'mts_xxx'). Must be a custom server"),
        name: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9_]+$/)
          .describe("Tool name in snake_case (e.g. 'get_weather', 'send_email')"),
        description: z.string().max(2000).optional().describe("Description of what the tool does"),
        inputSchema: z.string().optional().describe("JSON Schema string defining tool input parameters"),
        code: z
          .string()
          .optional()
          .describe(
            "JavaScript code for the tool. Must export a default async function. " +
              "Signature: execute(params, context). " +
              "context provides: log, http, kv, tables. " +
              'Example: export default async function execute(params, ctx) { return { result: "ok" }; }',
          ),
      },
    },
    async ({ serverId, name, description, inputSchema, code }) => {
      try {
        const { getMcpServerById, createMcpTool, isBuiltinServer } = await import("../../../../modules/mcp-tool-servers/mcp-tool-server.service.js");
        if (isBuiltinServer(serverId)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Cannot add tools to built-in server" }) }],
            isError: true,
          };
        }
        const svr = await getMcpServerById(serverId);
        if (!svr) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "MCP server not found" }) }],
            isError: true,
          };
        }
        const result = await createMcpTool(serverId, {
          name,
          description: description ?? "",
          inputSchema,
          code: code ?? "",
        });
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
