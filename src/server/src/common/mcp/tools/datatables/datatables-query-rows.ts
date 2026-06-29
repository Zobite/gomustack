import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDatatablesQueryRows(server: McpServer) {
  server.registerTool(
    "datatables_query_rows",
      {
        description: [
      "Query table rows using MQL (Mini Query Language — SQL-like syntax).",
      "Syntax: [SELECT col1, col2] [WHERE conditions] [ORDER BY col ASC|DESC] [LIMIT n] [OFFSET n].",
      "Operators: =, !=, >, >=, <, <=, LIKE '%text%', IN ('a','b'), BETWEEN x AND y, IS NULL, IS NOT NULL.",
      "Logic: AND, OR, parentheses for grouping.",
      "Use COUNT WHERE ... for count-only queries.",
      "Returns { rows, total, columns } or { count } for COUNT queries.",
      ].join(" "),
        inputSchema: {
      tableId: z
        .string()
        .min(1)
        .describe("Table ID (e.g. 'dtb_xxx'). Use datatables_list_tables to find table IDs"),
      q: z
        .string()
        .min(1)
        .describe(
          "MQL query string. Examples: " +
          "\"WHERE status = 'active' ORDER BY name LIMIT 10\", " +
          "\"SELECT name, email WHERE age > 25 AND city IN ('HCM', 'Hanoi')\", " +
          "\"COUNT WHERE active = true\", " +
          "\"WHERE name LIKE '%john%' ORDER BY created_at DESC\""
        ),
        },
      },
    async ({ tableId, q }) => {
      try {
        const { executeMqlQuery } = await import(
          "../../../../modules/datatables/utils/query.js"
        );
        const result = await executeMqlQuery(tableId, q);
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
