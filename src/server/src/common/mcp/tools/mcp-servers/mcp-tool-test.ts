import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMcpToolTest(server: McpServer) {
  server.registerTool(
    "mcp_tool_test",
    {
      description:
        "Test-execute an MCP tool in its JavaScript sandbox. Runs the tool's code with the given params and returns the result, stdout, stderr, and execution time. " +
        "Use source='draft' to test draft code or source='prod' to test production code.",
      inputSchema: {
        serverId: z.string().min(1).describe("MCP server ID the tool belongs to (e.g. 'mts_xxx')"),
        toolId: z.string().min(1).describe("MCP tool ID to test (e.g. 'mtl_xxx')"),
        params: z.record(z.unknown()).optional().describe("Input parameters to pass to the tool (matches tool's inputSchema)"),
        source: z.enum(["prod", "draft"]).optional().describe("Which code to run: 'prod' = published code, 'draft' = draft code (default: 'draft')"),
      },
    },
    async ({ serverId, toolId, params, source }) => {
      try {
        const { getMcpToolById, createMcpToolLog } = await import("../../../../modules/mcp-tool-servers/mcp-tool-server.service.js");
        const { executeMcpTool } = await import("../../../../modules/mcp-tool-servers/utils/executor.js");

        const tool = await getMcpToolById(toolId);
        if (!tool) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Tool not found" }) }],
            isError: true,
          };
        }

        const codeToTest = source === "prod" ? tool.code : (tool.draftCode ?? tool.code);
        const result = await executeMcpTool(tool.id, codeToTest, params ?? {}, {
          timeoutMs: 30_000,
          baseUrl: `http://127.0.0.1:${process.env.PORT ?? "5610"}`,
        });

        // Save execution log (fire-and-forget)
        createMcpToolLog({
          toolId: tool.id,
          serverId,
          callerType: "mcp_agent",
          callerInfo: "mcp_tool_test",
          inputParams: params ?? {},
          outputResult: result.result,
          status: result.success ? "success" : "error",
          errorMessage: result.success ? undefined : (result.stderr ?? "Unknown error"),
          executionTimeMs: result.executionTimeMs,
        }).catch(() => {});

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
