import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerDatatablesGetRow(server: McpServer) {
  server.registerTool(
    "datatables_get_row",
    {
      description: "Get a single row by ID from a table. Returns the full row data including all column values, timestamps, and metadata.",
      inputSchema: {
        tableId: z.string().min(1).describe("Table ID (e.g. 'dtb_xxx'). Use datatables_list_tables to find table IDs"),
        rowId: z.string().min(1).describe("Row ID to retrieve (e.g. 'dtr_xxx'). Use datatables_query_rows to find row IDs"),
      },
    },
    async ({ tableId, rowId }) => {
      try {
        const { getRowById } = await import("../../../../modules/datatables/table.service.js");
        const row = await getRowById(tableId, rowId);
        if (!row) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Row not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }],
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
