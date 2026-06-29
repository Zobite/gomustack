import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBrowserCreate(server: McpServer) {
  server.registerTool(
    "browser_create",
      {
        description: "Create a new browser profile with dynamic fingerprint generation. Each profile maintains persistent cookies, localStorage, and browser state across sessions.",
        inputSchema: {
      name: z
        .string()
        .min(1)
        .max(100)
        .describe("Profile name (1–100 characters, e.g. 'Stealth Scraping Profile')"),
      description: z
        .string()
        .max(500)
        .optional()
        .describe("Optional description for the profile (max 500 characters)"),
      proxyConfig: z
        .object({
          server: z.string().url().describe("Proxy server URL (e.g. 'http://ip:port' or 'socks5://ip:port')"),
          username: z.string().optional().describe("Proxy authentication username"),
          password: z.string().optional().describe("Proxy authentication password"),
        })
        .optional()
        .nullable()
        .describe("Proxy configuration. Set to null or omit for direct connection"),
      fingerprintConfig: z
        .object({
          userAgent: z.string().optional().describe("Custom User-Agent string. Auto-generated if omitted"),
          viewport: z
            .object({
              width: z.number().int().min(320).max(3840).default(1280).describe("Viewport width in pixels (320–3840, default: 1280)"),
              height: z.number().int().min(240).max(2160).default(800).describe("Viewport height in pixels (240–2160, default: 800)"),
            })
            .optional()
            .describe("Browser viewport dimensions"),
          locale: z.string().optional().describe("Browser locale (e.g. 'en-US', 'vi-VN')"),
          timezoneId: z.string().optional().describe("Timezone ID (e.g. 'Asia/Ho_Chi_Minh', 'America/New_York')"),
          geolocation: z
            .object({
              latitude: z.number().min(-90).max(90).describe("Latitude (-90 to 90)"),
              longitude: z.number().min(-180).max(180).describe("Longitude (-180 to 180)"),
              accuracy: z.number().min(0).optional().describe("Geolocation accuracy in meters"),
            })
            .optional()
            .describe("Fake geolocation coordinates"),
        })
        .optional()
        .nullable()
        .describe("Fingerprint overrides. Auto-generated if omitted"),
        },
      },
    async (params: {
      name: string;
      description?: string;
      proxyConfig?: { server: string; username?: string; password?: string } | null;
      fingerprintConfig?: {
        userAgent?: string;
        viewport?: { width: number; height: number };
        locale?: string;
        timezoneId?: string;
        geolocation?: { latitude: number; longitude: number; accuracy?: number };
      } | null;
    }) => {
      try {
        const { createBrowserProfile } = await import(
          "../../../../modules/browsers/browser.service.js"
        );
        const result = await createBrowserProfile(params);
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
