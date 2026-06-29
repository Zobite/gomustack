import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBrowserStop(server: McpServer) {
  server.registerTool(
    "browser_stop",
      {
        description: "Gracefully shut down a running browser profile. Saves the current session state (cookies, localStorage) and closes the Playwright context.",
        inputSchema: {
      id: z
        .string()
        .min(1)
        .describe("Browser profile ID to stop (e.g. 'bpr_xxxx')"),
        },
      },
    async ({ id }) => {
      try {
        const { stopBrowser } = await import(
          "../../../../modules/browsers/browser.service.js"
        );
        const result = await stopBrowser(id);
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
