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
        "click: click element by selector or visible text. " +
        "type: type into input field. " +
        "screenshot: capture page as PNG (saved to file, returns URL). " +
        "get_content: get full page HTML (large output — prefer get_snapshot). " +
        "eval: run JavaScript code. " +
        "wait: wait for element/text to appear. " +
        "sleep: pause execution for N ms. " +
        "scroll: scroll page up/down/top/bottom. " +
        "select: select option from dropdown. " +
        "press_key: press keyboard key (Enter, Escape, Tab, etc). " +
        "hover: hover over element. " +
        "extract_text: get text content of specific element. " +
        "get_snapshot: get accessibility tree (compact, LLM-friendly). " +
        "get_interactive_elements: list all clickable/typable elements",
    ),
  url: z.string().optional().describe("URL for 'navigate' action"),
  selector: z.string().optional().describe("Element selector for click/type/wait/hover/extract_text/select/press_key actions"),
  text: z.string().optional().describe("Text for 'type' action, or visible text for 'click'/'wait' (when no selector)"),
  code: z.string().optional().describe("JavaScript code for 'eval' action"),
  timeout: z.number().int().min(0).optional().describe("Timeout in ms. For 'sleep': pause duration. For others: max wait time"),
  selectorType: z
    .enum(["css", "text", "role", "label", "placeholder", "testid"])
    .optional()
    .describe("How to locate element. Default: 'css'. Options: css, text, role, label, placeholder, testid"),
  key: z.string().optional().describe("Key name for 'press_key' (e.g. 'Enter', 'Escape', 'Tab', 'ArrowDown')"),
  value: z.string().optional().describe("Option value for 'select' action"),
  direction: z.enum(["up", "down", "top", "bottom"]).optional().describe("Direction for 'scroll' action (default: 'down')"),
  amount: z.number().int().min(0).optional().describe("Pixels for 'scroll' action (default: 500)"),
});

export function registerBrowserRunSteps(server: McpServer) {
  server.registerTool(
    "browser_run_steps",
    {
      description: [
        "Execute a sequence of browser actions (batch automation).",
        "If profileId is provided, uses that profile's browser (must be running).",
        "If profileId is omitted, runs in a temporary ephemeral browser that auto-closes after.",
        "If tabIndex is omitted, creates a new tab (auto-closed after execution).",
        "If tabIndex is provided, reuses that existing tab (kept open).",
        "Returns results for each step in order.",
        "TIP: Use get_snapshot instead of get_content for compact LLM-friendly output.",
        "TIP: Screenshots are saved as files and return a URL instead of base64.",
      ].join(" "),
      inputSchema: {
        profileId: z.string().optional().nullable().describe("Browser profile ID (e.g. 'bpr_xxxx'). Omit to run in temporary ephemeral mode"),
        tabIndex: z.number().int().min(0).optional().describe("Tab index to reuse (0-based). Omit to create a new tab that auto-closes"),
        steps: z.array(stepSchema).min(1).describe("Array of browser action steps to execute in sequence"),
        continueOnError: z.boolean().optional().describe("If true, continue executing remaining steps even when one fails (default: false)"),
        includePageState: z.boolean().optional().describe("If true, append current URL + title + focused element info after each step (default: false)"),
      },
    },
    async (params: {
      profileId?: string | null;
      tabIndex?: number;
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
        // MCP has no HTTP request — use API_BASE_URL env var for screenshot URLs
        const result = await runBatchSteps({ ...params, baseUrl: getBaseUrl() } as any);
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
