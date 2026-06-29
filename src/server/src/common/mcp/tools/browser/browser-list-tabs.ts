import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBrowserListTabs(server: McpServer) {
  server.registerTool(
    "browser_list_tabs",
      {
        description: "List all active tabs/pages in a running browser profile. Returns an array of tabs with index, URL, and title.",
        inputSchema: {
      id: z
        .string()
        .min(1)
        .describe("Browser profile ID (e.g. 'bpr_xxxx'). Profile must be running"),
        },
      },
    async ({ id }) => {
      try {
        const { getActiveTabs } = await import(
          "../../../../modules/browsers/browser.service.js"
        );
        const result = await getActiveTabs(id);
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
