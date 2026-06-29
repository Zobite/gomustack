import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getBaseUrl } from "../../../../common/utils.js";

export function registerStorageGetDownloadUrl(server: McpServer) {
  server.registerTool(
    "storage_get_download_url",
    {
      description: "Generate a pre-signed download URL for an object. The URL is time-limited and can be shared for direct download access.",
      inputSchema: {
        bucketName: z.string().min(1).describe("Bucket name (e.g. 'uploads')"),
        key: z.string().min(1).describe("Object key / file path within the bucket (e.g. 'report.pdf')"),
        expiresInSeconds: z
          .number()
          .int()
          .min(60)
          .max(604800)
          .optional()
          .default(3600)
          .describe("URL expiration time in seconds (60–604800, default: 3600 = 1 hour). Max 7 days"),
      },
    },
    async ({ bucketName, key, expiresInSeconds }) => {
      try {
        const { createPresignedUrl } = await import("../../../../modules/storage/storage.service.js");
        const baseUrl = getBaseUrl();
        const result = await createPresignedUrl(bucketName, key, expiresInSeconds, baseUrl);
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
