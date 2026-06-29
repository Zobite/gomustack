import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerStorageDeleteObject(server: McpServer) {
  server.registerTool(
    "storage_delete_object",
      {
        description: "Delete an object (file) from a storage bucket. This permanently removes the file and cannot be undone. Returns { deleted: true, key }.",
        inputSchema: {
      bucketName: z
        .string()
        .min(1)
        .describe("Bucket name (e.g. 'uploads')"),
      key: z
        .string()
        .min(1)
        .describe("Object key / file path to delete (e.g. 'old-file.txt')"),
        },
      },
    async ({ bucketName, key }) => {
      try {
        const { deleteObject } = await import(
          "../../../../modules/storage/storage.service.js"
        );
        await deleteObject(bucketName, key);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, key }, null, 2) }],
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
