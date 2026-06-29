import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerStorageListObjects(server: McpServer) {
  server.registerTool(
    "storage_list_objects",
      {
        description: "List objects (files) in a storage bucket with pagination and optional prefix filter. Returns { items, total, page, totalPages }.",
        inputSchema: {
      bucketName: z
        .string()
        .min(1)
        .describe("Bucket name (e.g. 'uploads'). Use storage_list_buckets to find bucket names"),
      prefix: z
        .string()
        .optional()
        .describe("Key prefix filter to list objects under a specific path (e.g. 'images/' to list all files in the images folder)"),
      page: z
        .number()
        .int()
        .min(1)
        .optional()
        .default(1)
        .describe("Page number for pagination (1-indexed, default: 1)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .default(100)
        .describe("Number of items per page (1–500, default: 100)"),
        },
      },
    async ({ bucketName, prefix, page, limit }) => {
      try {
        const { listObjects } = await import(
          "../../../../modules/storage/storage.service.js"
        );
        const result = await listObjects(bucketName, { prefix, page, limit });
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
