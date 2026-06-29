import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDatatablesUpdateTable(server: McpServer) {
  server.registerTool(
    "datatables_update_table",
    {
      description: "Update a table's metadata (name, description). Use datatables_list_tables to find table IDs. Returns the updated table.",
      inputSchema: {
        tableId: z
          .string()
          .min(1)
          .describe("Table ID (e.g. 'dtb_xxx'). Use datatables_list_tables to find table IDs"),
        name: z
          .string()
          .min(1)
          .max(255)
          .optional()
          .describe("New table name"),
        description: z
          .string()
          .max(1000)
          .nullable()
          .optional()
          .describe("New table description. Set to null to clear"),
      },
    },
    async ({ tableId, name, description }) => {
      try {
        const { getTableById, updateTable } = await import(
          "../../../../modules/datatables/table.service.js"
        );
        const existing = await getTableById(tableId);
        if (!existing) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Table not found" }) }],
            isError: true,
          };
        }

        const result = await updateTable(tableId, { name, description });
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
