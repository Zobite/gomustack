import type { AgentEvent, TimelineStep } from "./types";

// ── Default tool labels ───────────────────────────────────────────────────────

export const DEFAULT_TOOL_LABELS: Record<string, string> = {
  write_code: "Write code",
  run_test: "Run test",
  fetch_web: "Fetch URL",
  browser_quick_run: "Browser quick run",
};



// ── Convert agent events to timeline steps ────────────────────────────────────

export function eventsToTimeline(events: AgentEvent[], isLive = false): TimelineStep[] {
  const steps: TimelineStep[] = [];
  let i = 0;

  while (i < events.length) {
    const ev = events[i];

    if (ev.type === "thinking" && ev.message) {
      let msg = ev.message;
      let j = i + 1;
      while (j < events.length && events[j].type === "thinking") {
        msg = events[j].message || msg;
        j++;
      }
      if (j >= events.length && isLive) {
        steps.push({ kind: "thinking", message: msg });
      }
      i = j;
    } else if (ev.type === "code" && ev.code) {
      steps.push({ kind: "code", chars: ev.code.length });
      i++;
    } else if (ev.type === "tool_call") {
      // Collect any code events between tool_call and tool_result
      // so they appear as separate "code generated" steps in the timeline
      let j = i + 1;
      while (j < events.length && events[j].type !== "tool_result" && events[j].type !== "tool_call") {
        if (events[j].type === "code" && events[j].code) {
          steps.push({ kind: "code", chars: events[j].code!.length });
        }
        j++;
      }
      const resultEvent = events[j];
      const hasResult = resultEvent?.type === "tool_result";
      const durationMs = hasResult && ev.receivedAt && resultEvent.receivedAt ? resultEvent.receivedAt - ev.receivedAt : undefined;
      steps.push({
        kind: "tool",
        name: ev.toolName || "tool",
        args: ev.toolArgs,
        result: hasResult ? resultEvent.toolResult : undefined,
        running: isLive && !hasResult,
        durationMs,
      });
      i = hasResult ? j + 1 : j;
    } else if (ev.type === "tool_result") {
      i++;
    } else if (ev.type === "text_delta") {
      // Accumulate consecutive text_delta events into a single streaming text block
      let accumulated = ev.message || "";
      const startAt = ev.receivedAt;
      let j = i + 1;
      while (j < events.length && events[j].type === "text_delta") {
        accumulated += events[j].message || "";
        j++;
      }
      const endAt = events[j - 1]?.receivedAt;
      // Check if followed by a "text" end-marker
      const hasEnd = j < events.length && events[j].type === "text";
      // Strip markdown code blocks — they are shown separately via "code" events
      const noCodeBlocks = accumulated.replace(/```(?:javascript|js|typescript|ts)?\n[\s\S]*?```/g, "");
      // Extract <think> blocks as separate collapsible steps
      const { thinkContent, remainingText } = extractThinkBlocks(noCodeBlocks);
      if (thinkContent) {
        const durationMs = startAt && endAt ? endAt - startAt : undefined;
        steps.push({ kind: "think_block", content: thinkContent, durationMs });
      }
      if (remainingText) {
        steps.push({ kind: "text", message: remainingText });
      }
      i = hasEnd ? j + 1 : j;
    } else if (ev.type === "text" && ev.message) {
      const { thinkContent, remainingText } = extractThinkBlocks(ev.message);
      if (thinkContent) {
        steps.push({ kind: "think_block", content: thinkContent });
      }
      if (remainingText) {
        steps.push({ kind: "text", message: remainingText });
      }
      i++;
    } else if (ev.type === "text") {
      // Empty text event = end-of-stream marker, skip
      i++;
    } else if (ev.type === "error" && ev.message) {
      steps.push({ kind: "error", message: ev.message });
      i++;
    } else {
      i++;
    }
  }

  return steps;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip `<think>...</think>` blocks from LLM output (e.g. Claude reasoning) */
export function stripThinkTags(text: string): string {
  // Remove complete <think>...</think> blocks (possibly multi-line)
  let result = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Remove unclosed <think>... at end of streaming text
  result = result.replace(/<think>[\s\S]*$/gi, "");
  return result.trim();
}

/** Extract <think> content and remaining text separately */
export function extractThinkBlocks(text: string): { thinkContent: string | null; remainingText: string } {
  let thinkContent = "";
  let remaining = text;

  // Extract complete <think>...</think> blocks
  for (const match of text.matchAll(/<think>([\s\S]*?)<\/think>/gi)) {
    const content = match[1].trim();
    if (content) {
      thinkContent += (thinkContent ? "\n" : "") + content;
    }
  }
  remaining = remaining.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // Extract unclosed <think>... at end (streaming in progress)
  const unclosedMatch = remaining.match(/<think>([\s\S]*)$/i);
  if (unclosedMatch) {
    const content = unclosedMatch[1].trim();
    if (content) {
      thinkContent += (thinkContent ? "\n" : "") + content;
    }
    remaining = remaining.replace(/<think>[\s\S]*$/i, "");
  }

  return {
    thinkContent: thinkContent || null,
    remainingText: remaining.trim(),
  };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function rawText(value: unknown, maxLen = 500): string {
  const s = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}
