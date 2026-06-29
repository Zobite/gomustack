import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBrowserStart(server: McpServer) {
  server.registerTool(
    "browser_start",
      {
        description: "Launch a browser profile in persistent background mode. Starts Playwright with the profile's saved cookies/state and opens a CDP (Chrome DevTools Protocol) port. Returns { id, status, cdpPort, wsEndpoint }.",
        inputSchema: {
      id: z
        .string()
        .min(1)
        .describe("Browser profile ID (e.g. 'bpr_xxxx'). Use browser_list to find profile IDs"),
        },
      },
    async ({ id }) => {
      try {
        const { startBrowser } = await import(
          "../../../../modules/browsers/browser.service.js"
        );
        const activeInfo = await startBrowser(id);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { id, status: "running", cdpPort: activeInfo.cdpPort, wsEndpoint: activeInfo.wsEndpoint },
                null,
                2,
              ),
            },
          ],
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
