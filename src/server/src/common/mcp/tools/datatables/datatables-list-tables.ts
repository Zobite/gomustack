import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDatatablesListTables(server: McpServer) {
  server.registerTool(
    "datatables_list_tables",
      {
        description: "List all tables in a project with their column definitions. Returns an array of tables, each containing id, name, columns[], and row count.",
        inputSchema: {
      projectId: z
        .string()
        .min(1)
        .describe("Project ID (e.g. 'prj_xxx'). Use datatables_list_projects to find project IDs"),
        },
      },
    async ({ projectId }) => {
      try {
        const { listTables } = await import(
          "../../../../modules/datatables/table.service.js"
        );
        const result = await listTables(projectId);
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
