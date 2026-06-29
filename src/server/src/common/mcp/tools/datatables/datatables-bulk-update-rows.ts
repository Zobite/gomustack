import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerDatatablesBulkUpdateRows(server: McpServer) {
  server.registerTool(
    "datatables_bulk_update_rows",
    {
      description:
        "Update multiple rows in a table in a single operation. Each update specifies a rowId and the data fields to update (merge, not replace). Returns { updated: <count>, items: [...] }.",
      inputSchema: {
        tableId: z.string().min(1).describe("Table ID (e.g. 'dtb_xxx'). Use datatables_list_tables to find table IDs"),
        updates: z
          .array(
            z.object({
              rowId: z.string().min(1).describe("Row ID to update (e.g. 'dtr_xxx')"),
              data: z.record(z.unknown()).describe("Fields to update as key-value object. Keys can be column IDs (col_xxx) or column names"),
            }),
          )
          .min(1)
          .max(100)
          .describe("Array of row updates. Each must have rowId and data. Max 100 rows per call"),
      },
    },
    async ({ tableId, updates }) => {
      try {
        const { bulkUpdateRows } = await import("../../../../modules/datatables/table.service.js");
        const result = await bulkUpdateRows(tableId, updates);
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
