import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBrowserDelete(server: McpServer) {
  server.registerTool(
    "browser_delete",
      {
        description: "Delete a browser profile permanently. Removes the database record and recursively deletes all saved cookies, localStorage, and state folders from disk. Cannot be undone.",
        inputSchema: {
      id: z
        .string()
        .min(1)
        .describe("Browser profile ID to delete (e.g. 'bpr_xxxx'). Profile must be stopped first"),
        },
      },
    async ({ id }) => {
      try {
        const { deleteBrowserProfile } = await import(
          "../../../../modules/browsers/browser.service.js"
        );
        const result = await deleteBrowserProfile(id);
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
