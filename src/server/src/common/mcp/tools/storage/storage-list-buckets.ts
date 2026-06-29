import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerStorageListBuckets(server: McpServer) {
  server.registerTool(
    "storage_list_buckets",
      {
        description: "List all storage buckets. Returns an array of buckets with name, creation date, and object count.",
      },
    async () => {
      try {
        const { listBuckets } = await import(
          "../../../../modules/storage/storage.service.js"
        );
        const result = await listBuckets();
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
