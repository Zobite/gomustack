import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerDatatablesUpdateColumn(server: McpServer) {
  server.registerTool(
    "datatables_update_column",
    {
      description:
        "Update an existing column's name, type, or options. Use datatables_list_tables to find column IDs (each column has an 'id' field like 'col_xxx'). Returns the updated column definition.",
      inputSchema: {
        tableId: z.string().min(1).describe("Table ID (e.g. 'dtb_xxx')"),
        columnId: z.string().min(1).describe("Column ID to update (e.g. 'col_xxx'). Found in table's columns array from datatables_list_tables"),
        name: z.string().min(1).max(255).optional().describe("New column name (optional)"),
        type: z.enum(["text", "number", "date", "boolean"]).optional().describe("New column type (optional). Changing type does not convert existing data"),
        options: z
          .object({
            numberFormat: z.enum(["integer", "decimal", "currency", "percent"]).optional(),
            includeTime: z.boolean().optional(),
          })
          .optional()
          .describe("Updated type-specific options (optional)"),
      },
    },
    async ({ tableId, columnId, name, type, options }) => {
      try {
        const { updateColumn } = await import("../../../../modules/datatables/table.service.js");
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (type !== undefined) updates.type = type;
        if (options !== undefined) updates.options = options;

        const col = await updateColumn(tableId, columnId, updates as any);
        if (!col) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Table or column not found" }) }],
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
