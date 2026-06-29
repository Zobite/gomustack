import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerKvDelete(server: McpServer) {
  server.registerTool(
    "kv_delete",
      {
        description: "Delete one or more variables by key. Pass `key` for a single deletion, or `keys` for bulk delete. Returns { deleted, notFound }.",
        inputSchema: {
      key: z
        .string()
        .optional()
        .describe("Single variable key to delete"),
      keys: z
        .array(z.string().min(1))
        .optional()
        .describe("Array of variable keys for bulk deletion (e.g. ['OLD_KEY', 'TEMP_VAR'])"),
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
        const { getVariableByKey, deleteVariable } = await import(
          "../../../../modules/kv-store/kv-store.service.js"
        );
        const allKeys = keys ?? (key ? [key] : []);
        const deleted: string[] = [];
        const notFound: string[] = [];
        for (const k of allKeys) {
          const v = await getVariableByKey(k);
          if (v) {
            await deleteVariable(v.id);
            deleted.push(k);
          } else {
            notFound.push(k);
          }
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ deleted, notFound }, null, 2) }],
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
