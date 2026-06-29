import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getBaseUrl } from "../../../../common/utils.js";

const stepSchema = z.object({
  action: z
    .enum([
      "navigate",
      "click",
      "type",
      "screenshot",
      "get_content",
      "eval",
      "wait",
      "sleep",
      "scroll",
      "select",
      "press_key",
      "hover",
      "extract_text",
      "get_snapshot",
      "get_interactive_elements",
    ])
    .describe(
      "Step action. " +
        "navigate: go to URL. " +
        "click: click element. " +
        "type: type into input. " +
        "screenshot: capture page (returns file URL). " +
        "get_content: get HTML. " +
        "eval: run JavaScript. " +
        "wait: wait for element/text. " +
        "sleep: pause N ms. " +
        "scroll: scroll page. " +
        "select: select dropdown option. " +
        "press_key: press key. " +
        "hover: hover element. " +
        "extract_text: get element text. " +
        "get_snapshot: accessibility tree (compact). " +
        "get_interactive_elements: list interactive elements",
    ),
  url: z.string().optional().describe("URL for 'navigate'"),
  selector: z.string().optional().describe("Element selector"),
  text: z.string().optional().describe("Text for 'type', or visible text for 'click'/'wait'"),
  code: z.string().optional().describe("JS code for 'eval'"),
  timeout: z.number().int().min(0).optional().describe("Timeout in ms"),
  selectorType: z.enum(["css", "text", "role", "label", "placeholder", "testid"]).optional().describe("Selector type (default: css)"),
  key: z.string().optional().describe("Key for 'press_key' (e.g. 'Enter')"),
  value: z.string().optional().describe("Value for 'select'"),
  direction: z.enum(["up", "down", "top", "bottom"]).optional().describe("Direction for 'scroll'"),
  amount: z.number().int().min(0).optional().describe("Pixels for 'scroll'"),
});

export function registerBrowserQuickRun(server: McpServer) {
  server.registerTool(
    "browser_quick_run",
    {
      description: [
        "Quick ephemeral browser — run steps without managing profiles.",
        "Launches a temporary incognito browser, executes all steps, then auto-closes immediately.",
        "Perfect for one-off tasks: scraping a page, checking a URL, extracting data.",
        "No profileId or tabIndex needed. Just provide steps.",
        "TIP: Use get_snapshot for compact page content instead of get_content.",
      ].join(" "),
      inputSchema: {
        steps: z.array(stepSchema).min(1).describe("Steps to execute in sequence"),
        continueOnError: z.boolean().optional().describe("Continue on step failure (default: false)"),
        includePageState: z.boolean().optional().describe("Include URL + title after each step (default: false)"),
      },
    },
    async (params: {
      steps: Array<{
        action: string;
        url?: string;
        selector?: string;
        text?: string;
        code?: string;
        timeout?: number;
        selectorType?: string;
        key?: string;
        value?: string;
        direction?: string;
        amount?: number;
      }>;
      continueOnError?: boolean;
      includePageState?: boolean;
    }) => {
      try {
        const { runBatchSteps } = await import("../../../../modules/browsers/browser.service.js");
        // Always ephemeral — no profileId, no tabIndex
        // MCP has no HTTP request — use API_BASE_URL env var for screenshot URLs
        const result = await runBatchSteps({
          profileId: null,
          steps: params.steps,
          continueOnError: params.continueOnError ?? false,
          includePageState: params.includePageState ?? false,
          baseUrl: getBaseUrl(),
        } as any);
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
