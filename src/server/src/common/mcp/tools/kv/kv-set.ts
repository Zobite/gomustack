import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const kvTypeEnum = z
  .enum(["string", "number", "boolean", "json"])
  .describe("Variable type. Auto-detected from value if omitted. Options: string, number, boolean, json");

const kvItemSchema = z.object({
  key: z.string().min(1).describe("Variable key (must be non-empty)"),
  value: z.string().describe("Variable value as string (numbers/booleans/JSON are stored as string, typed by 'type' field)"),
  type: kvTypeEnum.optional(),
  ttl: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Time-to-live in seconds. 0 or omit = no expiry"),
});

export function registerKvSet(server: McpServer) {
  server.registerTool(
    "kv_set",
      {
        description: "Create or update (upsert) one or more variables. Pass `key`+`value` for a single variable, or `items` array for bulk upsert. Type is auto-detected if omitted. Returns { count, items }.",
        inputSchema: {
      key: z
        .string()
        .optional()
        .describe("Single variable key (use with 'value'). Ignored if 'items' is provided"),
      value: z
        .string()
        .optional()
        .describe("Single variable value (use with 'key'). Ignored if 'items' is provided"),
      type: kvTypeEnum.optional(),
      ttl: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("TTL in seconds for the single key (0 or omit = no expiry)"),
      items: z
        .array(kvItemSchema)
        .optional()
        .describe("Array of { key, value, type?, ttl? } for bulk upsert. Overrides single key/value if provided"),
        },
      },
    async ({ key, value, type, ttl, items }: {
      key?: string;
      value?: string;
      type?: "string" | "number" | "boolean" | "json";
      ttl?: number;
      items?: Array<{ key: string; value: string; type?: "string" | "number" | "boolean" | "json"; ttl?: number }>;
    }) => {
      try {
        if (!items && (!key || value === undefined)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Either 'key'+'value' or 'items' array must be provided" }) }],
            isError: true,
          };
        }
        const { createVariable } = await import(
          "../../../../modules/kv-store/kv-store.service.js"
        );
        const itemsList = items ?? [{ key: key!, value: value!, type, ttl }];
        const results: unknown[] = [];
        for (const item of itemsList) {
          const v = await createVariable(item);
          if (v) results.push(v);
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ count: results.length, items: results }, null, 2) }],
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
