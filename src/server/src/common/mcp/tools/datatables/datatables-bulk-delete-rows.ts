import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerDatatablesBulkDeleteRows(server: McpServer) {
  server.registerTool(
    "datatables_bulk_delete_rows",
    {
      description:
        "Delete multiple rows from a table in a single operation. This permanently removes the rows and cannot be undone. Returns { deleted: <count> }.",
      inputSchema: {
        tableId: z.string().min(1).describe("Table ID (e.g. 'dtb_xxx'). Use datatables_list_tables to find table IDs"),
        rowIds: z.array(z.string().min(1)).min(1).max(100).describe("Array of row IDs to delete (e.g. ['dtr_xxx', 'dtr_yyy']). Max 100 rows per call"),
      },
    },
    async ({ tableId, rowIds }) => {
      try {
        const { bulkDeleteRows } = await import("../../../../modules/datatables/table.service.js");
        const result = await bulkDeleteRows(tableId, rowIds);
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
