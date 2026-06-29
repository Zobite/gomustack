import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerDatatablesDeleteColumn(server: McpServer) {
  server.registerTool(
    "datatables_delete_column",
    {
      description:
        "Delete a column from a table. This permanently removes the column definition and all associated cell data from every row. The primary (first) column cannot be deleted. Cannot be undone.",
      inputSchema: {
        tableId: z.string().min(1).describe("Table ID (e.g. 'dtb_xxx')"),
        columnId: z
          .string()
          .min(1)
          .describe(
            "Column ID to delete (e.g. 'col_xxx'). Found in table's columns array from datatables_list_tables. Cannot delete the primary column (first column)",
          ),
      },
    },
    async ({ tableId, columnId }) => {
      try {
        const { deleteColumn } = await import("../../../../modules/datatables/table.service.js");
        const result = await deleteColumn(tableId, columnId);
        if (!result) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Table or column not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, columnId }, null, 2) }],
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
