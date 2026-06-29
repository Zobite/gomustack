import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerStorageGetObjectInfo(server: McpServer) {
  server.registerTool(
    "storage_get_object_info",
      {
        description: "Get metadata for a specific object in a bucket. Returns size, content type, last modified date, and URLs.",
        inputSchema: {
      bucketName: z
        .string()
        .min(1)
        .describe("Bucket name (e.g. 'uploads')"),
      key: z
        .string()
        .min(1)
        .describe("Object key / file path within the bucket (e.g. 'images/logo.png')"),
        },
      },
    async ({ bucketName, key }) => {
      try {
        const { getObjectMeta } = await import(
          "../../../../modules/storage/storage.service.js"
        );
        const meta = await getObjectMeta(bucketName, key);
        if (!meta) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: `Object "${key}" not found in bucket "${bucketName}"` }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(meta, null, 2) }],
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
