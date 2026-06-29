// ── Agent Sidebar — Shared AI coding panel component ──────────────────────────

export { AgentSidebar } from "./AgentSidebar";
export { ChainOfThought } from "./ChainOfThought";
export { ModelPickerPopover } from "./ModelPickerPopover";
export { useAutoResize, useElapsedTimer } from "./hooks";
export { eventsToTimeline, formatDuration, rawText, stripThinkTags, extractThinkBlocks, DEFAULT_TOOL_LABELS } from "./timeline";

// Shared tool components (module-specific tools live in each module's tools/ folder)
export { FetchWebTool, DefaultTool, BrowserQuickRunTool } from "./tools";

export type {
  AgentEvent,
  ChatMessage,
  TimelineStep,
  ToolTimelineStep,
  ToolDetailProps,
  AgentSidebarAdapter,
  AgentSidebarCallbacks,
  AgentSidebarProps,
  AgentToolHookPayload,
  AgentRunParams,
} from "./types";
