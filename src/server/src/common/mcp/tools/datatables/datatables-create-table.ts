import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDatatablesCreateTable(server: McpServer) {
  server.registerTool(
    "datatables_create_table",
    {
      description: "Create a new table in a project. Requires at least one column definition. Returns the created table with id, name, columns, and rowCount.",
      inputSchema: {
        projectId: z
          .string()
          .min(1)
          .describe("Project ID (e.g. 'prj_xxx'). Use datatables_list_projects to find project IDs"),
        name: z
          .string()
          .min(1)
          .max(255)
          .describe("Table name (e.g. 'Users', 'Products')"),
        description: z
          .string()
          .max(1000)
          .optional()
          .describe("Optional description of the table"),
        columns: z
          .array(
            z.object({
              name: z.string().min(1).max(255).describe("Column name"),
              type: z.enum(["text", "number", "date", "boolean"]).describe("Column data type"),
            }),
          )
          .min(1)
          .describe(
            "Array of column definitions. At least 1 column is required. " +
            "Example: [{ \"name\": \"Name\", \"type\": \"text\" }, { \"name\": \"Age\", \"type\": \"number\" }]",
          ),
      },
    },
    async ({ projectId, name, description, columns }) => {
      try {
        const { getProjectById } = await import(
          "../../../../modules/datatables/project.service.js"
        );
        const project = await getProjectById(projectId);
        if (!project) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Project not found" }) }],
            isError: true,
          };
        }

        const { createTable } = await import(
          "../../../../modules/datatables/table.service.js"
        );
        const result = await createTable(
          projectId,
          { name, description, columns: columns.map((c) => ({ ...c, options: {} })) },
          "usr_mcp_system",
        );
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
