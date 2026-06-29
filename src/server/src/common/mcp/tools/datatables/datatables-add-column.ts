import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerDatatablesAddColumn(server: McpServer) {
  server.registerTool(
    "datatables_add_column",
    {
      description:
        "Add a new column to an existing table. The column is appended at the end. Supported types: text, number, date, boolean. Returns the created column definition.",
      inputSchema: {
        tableId: z.string().min(1).describe("Table ID (e.g. 'dtb_xxx'). Use datatables_list_tables to find table IDs"),
        name: z.string().min(1).max(255).describe("Column name (e.g. 'Email', 'Age', 'Active')"),
        type: z.enum(["text", "number", "date", "boolean"]).describe("Column data type: 'text', 'number', 'date', or 'boolean'"),
        options: z
          .object({
            numberFormat: z.enum(["integer", "decimal", "currency", "percent"]).optional().describe("Number display format (only for type 'number')"),
            includeTime: z.boolean().optional().describe("Whether to include time (only for type 'date')"),
          })
          .optional()
          .describe("Type-specific options (optional)"),
      },
    },
    async ({ tableId, name, type, options }) => {
      try {
        const { addColumn } = await import("../../../../modules/datatables/table.service.js");
        const col = await addColumn(tableId, { name, type, options: options ?? {} });
        if (!col) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Table not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(col, null, 2) }],
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
