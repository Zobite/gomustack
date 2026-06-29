import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDatatablesInsertRow(server: McpServer) {
  server.registerTool(
    "datatables_insert_row",
      {
        description: "Insert a new row into a table. Use datatables_list_tables first to find table IDs and column definitions. Returns the created row.",
        inputSchema: {
      tableId: z
        .string()
        .min(1)
        .describe("Table ID (e.g. 'dtb_xxx'). Use datatables_list_tables to find table IDs"),
      data: z
        .record(z.unknown())
        .describe(
          "Row data as key-value object where keys are column IDs and values are the cell values. " +
          "Example: { \"col_name\": \"John\", \"col_age\": 30, \"col_active\": true }"
        ),
        },
      },
    async ({ tableId, data }) => {
      try {
        const { createRow } = await import(
          "../../../../modules/datatables/table.service.js"
        );
        const result = await createRow(tableId, { data }, "usr_mcp_system");
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
