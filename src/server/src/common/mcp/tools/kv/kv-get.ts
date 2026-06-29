import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerKvGet(server: McpServer) {
  server.registerTool(
    "kv_get",
      {
        description: "Get one or more variables by key. Pass `key` for a single variable, or `keys` for bulk retrieval. Returns { items, missing }.",
        inputSchema: {
      key: z
        .string()
        .optional()
        .describe("Single variable key to retrieve (e.g. 'API_KEY')"),
      keys: z
        .array(z.string().min(1))
        .optional()
        .describe("Array of variable keys for bulk retrieval (e.g. ['API_KEY', 'DB_URL'])"),
        },
      },
    async ({ key, keys }: { key?: string; keys?: string[] }) => {
      try {
        if (!key && (!keys || keys.length === 0)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Either 'key' or 'keys' must be provided" }) }],
            isError: true,
          };
        }
        const { getVariableByKey } = await import(
          "../../../../modules/kv-store/kv-store.service.js"
        );
        const allKeys = keys ?? (key ? [key] : []);
        const items: unknown[] = [];
        const missing: string[] = [];
        for (const k of allKeys) {
          const v = await getVariableByKey(k);
          if (v) items.push(v);
          else missing.push(k);
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ items, missing }, null, 2) }],
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
