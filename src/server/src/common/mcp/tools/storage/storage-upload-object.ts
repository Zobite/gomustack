import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerStorageUploadObject(server: McpServer) {
  server.registerTool(
    "storage_upload_object",
    {
      description:
        "Upload a file to a storage bucket. Content can be plain text or base64-encoded binary data. " +
        "If the key already exists, the file is overwritten (upsert). Returns the object metadata.",
      inputSchema: {
        bucketName: z
          .string()
          .min(1)
          .describe("Bucket name (e.g. 'uploads'). Use storage_list_buckets to find bucket names"),
        key: z
          .string()
          .min(1)
          .describe("Object key / file path within the bucket (e.g. 'reports/data.csv', 'config.json')"),
        content: z
          .string()
          .describe(
            "File content. For text files, provide the raw text. " +
            "For binary files (images, PDFs, etc.), provide base64-encoded data",
          ),
        encoding: z
          .enum(["utf-8", "base64"])
          .optional()
          .default("utf-8")
          .describe("Content encoding: 'utf-8' for plain text (default), 'base64' for binary data"),
        contentType: z
          .string()
          .optional()
          .describe("MIME type (e.g. 'application/json', 'image/png'). Auto-detected from key extension if omitted"),
      },
    },
    async ({ bucketName, key, content, encoding, contentType }) => {
      try {
        const { uploadObject } = await import(
          "../../../../modules/storage/storage.service.js"
        );

        let data: Buffer;
        if (encoding === "base64") {
          data = Buffer.from(content, "base64");
        } else {
          data = Buffer.from(content, "utf-8");
        }

        const result = await uploadObject(bucketName, key, data, contentType);
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
