/**
 * Dynamic API Coding Agent
 *
 * AI agent that generates JavaScript code for Dynamic API handlers.
 * Uses LangChain/LangGraph for the agent loop with tool calling.
 * Mirrors the MCP Tool Coding Agent pattern.
 */

import type { AIMessageChunk } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import TurndownService from "turndown";
import { z } from "zod";
import { fetchBrowser } from "../../../common/utils/fetch-browser.js";
import { executeIsolated, hasNpmImports } from "../../../common/sandbox/js-executor.js";
import { getChatModelForProvider } from "../../llm-providers/utils/chat.js";
import { getDynamicApiById, updateDynamicApi } from "../dynamic-api.service.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CodingAgentRequest {
  providerId: string;
  model: string;
  prompt: string;
  currentCode: string;
  apiId: string;
  method: string;
  path: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AgentEvent {
  type: "thinking" | "tool_call" | "tool_result" | "text" | "text_delta" | "code" | "done" | "error";
  message?: string;
  code?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  duration?: number;
}

// ── Dry-run execution (sandbox) ──────────────────────────────────────────────

async function dryRunCode(
  code: string,
  apiId: string,
  method: string,
  path: string,
  testInput?: {
    body?: unknown;
    query?: Record<string, string>;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  },
): Promise<{
  status: number;
  body: unknown;
  consoleLogs: string[];
  error?: string;
  executionTimeMs: number;
}> {
  const requestObj = {
    method,
    path,
    params: testInput?.params || {},
    query: testInput?.query || {},
    headers: testInput?.headers || {},
    body: testInput?.body ?? null,
  };

  const needsIsolation = hasNpmImports(code);

  if (needsIsolation) {
    const result = await executeIsolated({
      apiId,
      code,
      request: requestObj,
      timeoutMs: 15000,
    });
    return {
      status: result.status,
      body: result.body,
      consoleLogs: result.consoleLogs || [],
      error: result.error,
      executionTimeMs: result.executionTimeMs,
    };
  }

  const startTime = Date.now();
  const consoleLogs: string[] = [];
  const context = {
    log: (...args: unknown[]) => {
      consoleLogs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    },
  };

  try {
    const cleanCode = code.replace(/export\s+default\s+/g, "").replace(/module\.exports\s*=\s*/g, "");

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const factory = new AsyncFunction(
      `${cleanCode}
       if (typeof handler === 'function') return handler;
       throw new Error('No handler function found.');`,
    );

    const handler = await factory();
    const result = (await Promise.race([
      handler(requestObj, context),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Execution timeout")), 15000)),
    ])) as Record<string, unknown>;

    return {
      status: (result?.status as number) ?? 200,
      body: result?.body ?? result,
      consoleLogs,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      status: 500,
      body: { error: "execution_error", message: error.message },
      consoleLogs,
      error: error.stack || error.message,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

// ── Fetch Web utility ────────────────────────────────────────────────────────

async function fetchWebContent(url: string, mode: "raw" | "md" = "raw", headers?: Record<string, string>): Promise<string> {
  try {
    const res = await fetchBrowser(url, 10_000, headers);
    if (!res.ok) return `HTTP Error ${res.status}: ${res.statusText}`;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return JSON.stringify(await res.json(), null, 2).slice(0, 8000);
    }
    const html = await res.text();
    if (mode === "md") {
      const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
      return td.turndown(html).slice(0, 8000);
    }
    return html.slice(0, 8000);
  } catch (err) {
    return `Fetch error: ${(err as Error).message}`;
  }
}

// ── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a JavaScript API handler code generator for the GomuStack Dynamic API system.

Handler pattern — EVERY handler MUST use this exact structure:
\`\`\`javascript
export default async function handler(request, context) {
  // request: { method, path, params, query, headers, body }
  // context: { log(...args) }
  //
  // request.method  — HTTP method (GET, POST, PUT, PATCH, DELETE)
  // request.path    — Request path (e.g. /users/123)
  // request.params  — Path parameters from route pattern (:id → params.id)
  // request.query   — URL query parameters (?page=1&limit=10)
  // request.headers — HTTP request headers
  // request.body    — Parsed request body (JSON) or null for GET
  //
  // context.log(...args) — Log for debugging output

  return { status: 200, body: { message: "Hello" } };
}
\`\`\`

PATH PARAMETERS:
- Route patterns like /videos/:videoId mean the handler receives request.params.videoId
- Route /users/:userId/posts/:postId → request.params = { userId: "...", postId: "..." }
- ALWAYS access path params via request.params, NOT by parsing request.path

GENERAL RULES:
- Always export default the handler function
- Return { status, headers?, body? }
- You can use fetch() for external API calls
- You can import npm packages (e.g. import _ from "lodash")
- NEVER use process.env
- Use context.log() for debugging output

TOOLS AVAILABLE:
- write_code: Save handler code as draft
- run_test: Test the draft code with params
- fetch_web: Fetch raw content from a URL (no JS rendering)
- browser_quick_run: Launch an ephemeral stealth browser and run automation steps (navigate, click, type, screenshot, extract_text, get_snapshot, etc.)

WHEN TO USE browser_quick_run vs fetch_web:
- Use fetch_web for simple API calls or static HTML pages
- Use browser_quick_run when you need:
  • JavaScript-rendered content (SPAs, dynamic pages)
  • Screenshots of web pages
  • Interacting with web UI (click buttons, fill forms)
  • Extracting data from JS-heavy sites
  • Getting accessibility snapshots (get_snapshot)
  • Testing how a URL looks/works in a real browser

browser_quick_run STEPS reference:
- navigate: go to URL (requires url)
- click: click element (requires selector or text)
- type: type into input (requires selector + text)
- screenshot: capture page as PNG (returns file URL)
- get_content: get full HTML
- get_snapshot: get accessibility tree (compact, preferred over get_content)
- get_interactive_elements: list clickable/interactive elements
- extract_text: get text from element (requires selector)
- eval: run JavaScript on page (requires code)
- wait: wait for element/text to appear
- sleep: pause N ms
- scroll: scroll page (direction: up/down/top/bottom)
- select: select dropdown option
- press_key: press keyboard key (requires key, e.g. "Enter")
- hover: hover over element

WORKFLOW — choose the right approach based on the user's request:

## A) User asks to WRITE or MODIFY code:
1. Analyze the user's request
2. Call write_code with the COMPLETE code
3. IMMEDIATELY call run_test with realistic params — MANDATORY after write_code
4. If the test fails, fix the code with write_code, then call run_test again
5. Repeat write→test cycle until tests pass, then respond with a short text summary

## B) User asks to TEST or DEBUG existing code (e.g. "test this", "run it", "try it"):
1. Call run_test directly with realistic params — use the current code as-is
2. Report the test result
3. If test fails and you can identify the issue, offer to fix with write_code → run_test
4. Do NOT rewrite code unless the user asks you to or the test reveals a bug

## C) User asks a QUESTION (e.g. "what does this do?", "explain the code"):
1. Just respond with text — no tool calls needed

## D) User asks to SCRAPE, SCREENSHOT, or INTERACT with a web page:
1. Use browser_quick_run with appropriate steps
2. Use the results to inform your code or response

RULES:
- After EVERY write_code call, your VERY NEXT action MUST be run_test. NEVER skip this.
- NEVER call write_code twice in a row without run_test in between.
- Do NOT write code in markdown code blocks. Always use the write_code tool.
- Do NOT rewrite code unnecessarily — if the user just wants to test, use run_test directly.
- When user says "test", "try", "run" etc. without asking for changes → use Workflow B.
- browser_quick_run is limited to 5 calls per session. Use it wisely.`;

// ── Tool factory ─────────────────────────────────────────────────────────────

function createLangChainTools(
  reqData: CodingAgentRequest,
  fetchWebCount: { count: number },
  codeChangedThisTurn: { value: boolean },
  onEvent: (event: AgentEvent) => void,
) {
  // Guard: force model to call run_test after every write_code
  const pendingTest = { value: false };

  const fetchWebTool = tool(
    async ({ url, mode, headers }: { url: string; mode?: string; headers?: Record<string, string> }) => {
      fetchWebCount.count++;
      if (fetchWebCount.count > 10) {
        return `[LIMIT REACHED] You have already made 10 fetch_web calls. Use the information you have to write the code.`;
      }
      return await fetchWebContent(url, (mode as "raw" | "md") ?? "raw", headers);
    },
    {
      name: "fetch_web",
      description: "Fetch content from a URL. Use ONLY when you need to inspect a specific target URL or read unknown API documentation. You can pass custom headers (e.g. Authorization, Accept).",
      schema: z.object({
        url: z.string().url(),
        mode: z.enum(["raw", "md"]).optional(),
        headers: z.record(z.string()).optional().describe("Custom HTTP headers to send with the request (e.g. Authorization, Accept, Cookie)"),
      }),
    },
  );

  const writeCodeTool = tool(
    async ({ code }: { code: string }) => {
      // If model called write_code again without testing — auto-test the PREVIOUS code first
      if (pendingTest.value) {
        const apiItem = await getDynamicApiById(reqData.apiId);
        const prevCode = apiItem?.draftCode ?? apiItem?.code;
        if (prevCode) {
          const autoTestResult = await dryRunCode(prevCode, reqData.apiId, reqData.method, reqData.path);
          onEvent({ type: "tool_call", toolName: "run_test", toolArgs: { params: "(auto-test: you forgot to call run_test)" } });
          onEvent({ type: "tool_result", toolName: "run_test", toolResult: autoTestResult });
        }
      }

      await updateDynamicApi(reqData.apiId, { draftCode: code });
      codeChangedThisTurn.value = true;
      pendingTest.value = true;
      onEvent({ type: "code", code });

      // Extract path params from route to tell model what to pass to run_test
      const pathParams = (reqData.path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g) || []).map((p) => p.slice(1));
      const paramHint = pathParams.length > 0 ? ` Required path params for run_test: ${pathParams.map((p) => `${p} (string)`).join(", ")}.` : "";

      return JSON.stringify({
        success: true,
        nextStep: `⚠️ MANDATORY: Call run_test NOW with realistic params. Do NOT call write_code again.${paramHint}`,
      });
    },
    {
      name: "write_code",
      description: "Save the generated handler code as a draft. MANDATORY: Your very next tool call after this MUST be run_test. Never call write_code twice in a row.",
      schema: z.object({
        code: z.string().describe("The complete JavaScript handler code to save"),
      }),
    },
  );

  const runTestTool = tool(
    async ({ body, query, params, headers }: { body?: Record<string, unknown>; query?: Record<string, string>; params?: Record<string, string>; headers?: Record<string, string> }) => {
      pendingTest.value = false;
      const apiItem = await getDynamicApiById(reqData.apiId);
      const codeToRun = apiItem?.draftCode ?? apiItem?.code;
      if (!codeToRun) {
        return JSON.stringify({ success: false, result: { error: "no_code", message: "No code found. Call write_code first." } });
      }

      // Validate path params
      const pathParamNames = (reqData.path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g) || []).map((p) => p.slice(1));
      if (pathParamNames.length > 0 && (!params || Object.keys(params).length === 0)) {
        return JSON.stringify({
          success: false,
          error: "empty_params",
          message: `You passed empty params but this route has ${pathParamNames.length} path parameter(s). Call run_test again with realistic values.`,
          requiredParams: pathParamNames.map((p) => `${p}: string`),
        });
      }

      const result = await dryRunCode(codeToRun, reqData.apiId, reqData.method, reqData.path, {
        body,
        query,
        params,
        headers,
      });
      return JSON.stringify(result);
    },
    {
      name: "run_test",
      description:
        "Test the current draft handler code. Returns status, body, consoleLogs, error, and executionTimeMs. If the route has path params (e.g. /items/:id), you MUST provide the `params` object with matching values.",
      schema: z.object({
        body: z.record(z.unknown()).optional().describe("Request body (for POST/PUT/PATCH)"),
        query: z.record(z.string()).optional().describe("Query string params (e.g. ?page=1)"),
        params: z
          .record(z.string())
          .optional()
          .describe("URL path params — REQUIRED when route has :paramName placeholders. Example: { videoId: 'abc123' } for route /videos/:videoId"),
        headers: z.record(z.string()).optional().describe("Request headers"),
      }),
    },
  );

  // ── browser_quick_run tool ──────────────────────────────────────────────────

  const browserQuickRunCount = { count: 0 };

  const browserQuickRunTool = tool(
    async ({ steps, continueOnError, includePageState }: {
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
      browserQuickRunCount.count++;
      if (browserQuickRunCount.count > 5) {
        return `[LIMIT REACHED] You have already made 5 browser_quick_run calls this session. Use the data you have.`;
      }
      try {
        const { runBatchSteps } = await import("../../browsers/browser.service.js");
        const result = await runBatchSteps({
          profileId: null,
          steps,
          continueOnError: continueOnError ?? false,
          includePageState: includePageState ?? false,
        } as any);
        return JSON.stringify(result, null, 2);
      } catch (err: unknown) {
        return JSON.stringify({ error: (err as Error).message });
      }
    },
    {
      name: "browser_quick_run",
      description: "Launch an ephemeral stealth browser and run automation steps. Perfect for scraping JS-rendered pages, taking screenshots, interacting with web UIs. No profile needed — browser auto-closes after execution.",
      schema: z.object({
        steps: z.array(z.object({
          action: z.enum([
            "navigate", "click", "type", "screenshot", "get_content", "eval",
            "wait", "sleep", "scroll", "select", "press_key", "hover",
            "extract_text", "get_snapshot", "get_interactive_elements",
          ]).describe("Step action"),
          url: z.string().optional().describe("URL for navigate"),
          selector: z.string().optional().describe("Element selector"),
          text: z.string().optional().describe("Text for type, or visible text for click/wait"),
          code: z.string().optional().describe("JS code for eval"),
          timeout: z.number().int().min(0).optional().describe("Timeout in ms"),
          selectorType: z.enum(["css", "text", "role", "label", "placeholder", "testid"]).optional().describe("Selector type (default: css)"),
          key: z.string().optional().describe("Key for press_key (e.g. Enter)"),
          value: z.string().optional().describe("Value for select"),
          direction: z.enum(["up", "down", "top", "bottom"]).optional().describe("Direction for scroll"),
          amount: z.number().int().min(0).optional().describe("Pixels for scroll"),
        })).min(1).describe("Steps to execute in sequence"),
        continueOnError: z.boolean().optional().describe("Continue on step failure (default: false)"),
        includePageState: z.boolean().optional().describe("Include URL + title after each step"),
      }),
    },
  );

  return [fetchWebTool, writeCodeTool, runTestTool, browserQuickRunTool];
}

// ── Stream agent and emit events ─────────────────────────────────────────────

async function streamAgentEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: any,
  input: { messages: Array<{ role: string; content: string }> },
  onEvent: (event: AgentEvent) => void,
): Promise<{ text: string }> {
  let accumulatedText = "";

  // Track tool calls in progress to pair with results and compute duration
  const toolCallTimers = new Map<string, number>();

  const stream = agent.streamEvents(input, {
    version: "v2",
    recursionLimit: 100,
  });

  for await (const event of stream) {
    const eventType = event.event;

    if (eventType === "on_chat_model_stream") {
      // Token-level streaming from the LLM
      const chunk = event.data.chunk as AIMessageChunk;

      // Text content streaming
      if (chunk.content && typeof chunk.content === "string" && chunk.content.length > 0) {
        accumulatedText += chunk.content;
        onEvent({ type: "text_delta", message: chunk.content });
      }

      // Tool call streaming — detect when model starts generating a tool call
      if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
        // Tool call chunks are streamed incrementally, we just track them
        // The actual tool_call event will be emitted on_tool_start
      }
    } else if (eventType === "on_tool_start") {
      const toolName = event.name;
      // LangGraph may wrap input in { input: ... } or pass it directly
      let toolInput = event.data?.input;
      // If input is wrapped in an "input" key with a stringified value, unwrap it
      if (toolInput && typeof toolInput === "object" && "input" in toolInput && Object.keys(toolInput).length === 1) {
        const inner = toolInput.input;
        if (typeof inner === "string") {
          try {
            toolInput = JSON.parse(inner);
          } catch {
            toolInput = inner;
          }
        } else {
          toolInput = inner;
        }
      }
      toolCallTimers.set(event.run_id, Date.now());

      // Emit tool_call event
      if (toolName === "write_code") {
        const codeLen = typeof toolInput?.code === "string" ? toolInput.code.length : 0;
        onEvent({ type: "tool_call", toolName, toolArgs: { code: `[${codeLen} chars]` } });
      } else {
        onEvent({ type: "tool_call", toolName, toolArgs: toolInput });
      }
    } else if (eventType === "on_tool_end") {
      const toolName = event.name;
      let toolResult: unknown;

      // LangGraph v2 returns ToolMessage objects with .content property
      // Extract the raw output string from the ToolMessage or use directly
      const rawOutput = event.data?.output;
      let outputStr: string | undefined;

      if (typeof rawOutput === "string") {
        outputStr = rawOutput;
      } else if (rawOutput && typeof rawOutput === "object") {
        // ToolMessage object — extract .content
        const content = (rawOutput as Record<string, unknown>).content;
        if (typeof content === "string") {
          outputStr = content;
        }
      }

      if (outputStr) {
        try {
          toolResult = JSON.parse(outputStr);
        } catch {
          toolResult = outputStr;
        }
      } else {
        toolResult = rawOutput;
      }

      // For fetch_web, truncate the result for display
      if (toolName === "fetch_web" && typeof outputStr === "string") {
        toolResult = outputStr.slice(0, 300) + (outputStr.length > 300 ? "…" : "");
      }

      const startTime = toolCallTimers.get(event.run_id);
      const duration = startTime ? Date.now() - startTime : undefined;
      toolCallTimers.delete(event.run_id);

      onEvent({ type: "tool_result", toolName, toolResult, duration });
    } else if (eventType === "on_chain_start" && event.name === "agent") {
      onEvent({ type: "thinking", message: "Analyzing and planning next step…" });
    } else if (eventType === "on_chain_error") {
      onEvent({ type: "error", message: String(event.data?.error || "Unknown error") });
    }
  }

  return { text: accumulatedText };
}

// ── Run Agent ────────────────────────────────────────────────────────────────

export async function runCodingAgent(reqData: CodingAgentRequest, onEvent: (event: AgentEvent) => void): Promise<void> {
  const model = await getChatModelForProvider(reqData.providerId, reqData.model);

  const fetchWebCount = { count: 0 };
  const codeChangedThisTurn = { value: false };

  // ── Build messages ──────────────────────────────────────────────────────

  // Embed current code into system prompt so LLM always knows the latest draft
  let systemContent = SYSTEM_PROMPT;
  if (reqData.currentCode) {
    systemContent += `\n\nCurrent code draft:\n\`\`\`javascript\n${reqData.currentCode}\n\`\`\``;
  }

  const hasHistory = reqData.history && reqData.history.length > 0;

  // Build user message
  // - History is embedded as context text (not separate turns) to avoid
  //   validation errors with tool-registered assistant messages
  // - API metadata (method, path) only sent on first message
  let userMsg = "";

  if (hasHistory) {
    userMsg += "Previous conversation:\n";
    for (const msg of reqData.history!) {
      userMsg += `[${msg.role.toUpperCase()}]: ${msg.content}\n\n`;
    }
    userMsg += "---\n\nNew request:\n";
  }

  userMsg += reqData.prompt;

  // Only include API metadata on the first message — LLM already knows from history
  if (!hasHistory) {
    userMsg += `\n\nAPI endpoint: ${reqData.method} ${reqData.path}`;

    // Parse path params from route pattern
    const pathParams = (reqData.path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g) || []).map((p) => p.slice(1));

    if (pathParams.length > 0) {
      userMsg += `\n\n⚠️ PATH PARAMETERS:`;
      userMsg += `\nThis route has path parameters: ${pathParams.map((p) => `\`:${p}\``).join(", ")}`;
      userMsg += `\nWhen calling run_test, you MUST include: params: { ${pathParams.map((p) => `${p}: "<realistic_value>"`).join(", ")} }`;
    }

    if (["POST", "PUT", "PATCH"].includes(reqData.method)) {
      userMsg += `\nThis endpoint uses ${reqData.method}, so the handler likely receives data in \`request.body\`. Provide a realistic \`body\` object when testing.`;
    }
  }

  const messages = [
    { role: "system", content: systemContent },
    { role: "user", content: userMsg },
  ];

  // ── Create agent graph ──────────────────────────────────────────────────

  const tools = createLangChainTools(reqData, fetchWebCount, codeChangedThisTurn, onEvent);
  const modelWithTools = (model as any).bindTools(tools);

  // Model node: invoke LLM with tool bindings
  async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await modelWithTools.invoke(state.messages);
    return { messages: [response] };
  }

  // Build the agent graph: model → (tools → model)* → end
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("model", callModel)
    .addNode("tools", new ToolNode(tools))
    .addEdge(START, "model")
    .addConditionalEdges("model", toolsCondition, { tools: "tools", [END]: END })
    .addEdge("tools", "model");

  const agent = workflow.compile();

  try {
    await streamAgentEvents(agent, { messages }, onEvent);
  } catch (err) {
    const errObj = err as Record<string, unknown>;
    console.error("[CodingAgent] runCodingAgent error:", err);
    if (errObj.responseBody) {
      console.error("[CodingAgent] Response body:", String(errObj.responseBody).slice(0, 500));
    }
    onEvent({ type: "error", message: (err as Error).message });
  }

  // Query DB for the latest code to include in done event
  const finalApi = await getDynamicApiById(reqData.apiId);
  onEvent({ type: "done", code: finalApi?.draftCode ?? finalApi?.code ?? undefined });
}
