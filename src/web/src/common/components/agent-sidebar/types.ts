import type { ComponentType } from "react";

// ── Agent Event (SSE stream) ─────────────────────────────────────────────────

export interface AgentEvent {
  type: "thinking" | "tool_call" | "tool_result" | "text" | "text_delta" | "code" | "done" | "error";
  message?: string;
  code?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  duration?: number;
  receivedAt?: number;
}

// ── Chat Message ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  events?: AgentEvent[];
  code?: string;
  cancelled?: boolean;
}

// ── Timeline Step ─────────────────────────────────────────────────────────────

export type TimelineStep =
  | { kind: "thinking"; message: string }
  | { kind: "think_block"; content: string; durationMs?: number }
  | { kind: "code"; chars: number }
  | { kind: "tool"; name: string; args?: Record<string, unknown>; result?: unknown; running: boolean; durationMs?: number }
  | { kind: "text"; message: string }
  | { kind: "error"; message: string };

export type ToolTimelineStep = Extract<TimelineStep, { kind: "tool" }>;

// ── Tool Detail Component Props ───────────────────────────────────────────────

export interface ToolDetailProps {
  step: ToolTimelineStep;
}

// ── Adapter Interface ─────────────────────────────────────────────────────────

export interface AgentSidebarAdapter {
  /** Per-tool custom components — keyed by tool name. These render the ENTIRE tool step (no default header). */
  toolComponents?: Record<string, ComponentType<ToolDetailProps>>;

  /** Custom TOOL_LABEL map — merged with defaults */
  toolLabels?: Record<string, string>;
}

// ── Run Params (passed to onRun callback) ─────────────────────────────────────

export interface AgentRunParams {
  providerId: string;
  model: string;
  prompt: string;
  currentCode: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  signal: AbortSignal;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Hook payload fired when a tool event occurs during agent execution */
export interface AgentToolHookPayload {
  /** Which phase: 'call' when tool starts, 'result' when tool finishes, 'code' when code event */
  phase: "call" | "result" | "code";
  /** Tool name (e.g. 'write_code', 'run_test', 'fetch_web') */
  toolName: string;
  /** Tool arguments (available on 'call' and 'code' phases) */
  args?: Record<string, unknown>;
  /** Tool result (available on 'result' phase) */
  result?: unknown;
  /** The raw code string (available on 'code' phase, extracted from write_code) */
  code?: string;
  /** Whether this is the final event (stream done) */
  isFinal?: boolean;
}

// ── Callbacks ─────────────────────────────────────────────────────────────────

export interface AgentSidebarCallbacks {
  /** Called when the agent starts running */
  onStart?: () => void;
  /** Called when the agent finishes (including error/cancel) */
  onComplete?: (result: { code?: string; cancelled?: boolean; error?: string }) => void;
  /** Called on each SSE event */
  onEvent?: (event: AgentEvent) => void;
  /** Called when new code is generated (real-time, each code event) */
  onCodeGenerated?: (code: string) => void;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AgentSidebarProps {
  adapter: AgentSidebarAdapter;
  currentCode: string;
  /** Module panel handles the fetch call — receives run params, returns a Response for SSE parsing */
  onRun: (params: AgentRunParams) => Promise<Response>;
  /** Generic hook for tool events — consumers check toolName and decide what to do */
  onHooks?: (payload: AgentToolHookPayload) => void;
  callbacks?: AgentSidebarCallbacks;
}
