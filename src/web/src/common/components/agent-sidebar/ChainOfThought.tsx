import { useState, useRef, useEffect, useMemo, type ComponentType } from "react";
import { Brain, ChevronRight, Code2, Loader2, Play, Sparkles, XCircle } from "lucide-react";
import Markdown from "react-markdown";
import type { Components, ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.min.css";
import { eventsToTimeline, formatDuration, DEFAULT_TOOL_LABELS } from "./timeline";
import { FetchWebTool, BrowserQuickRunTool, DefaultTool } from "./tools";
import type { AgentEvent, AgentSidebarAdapter, TimelineStep, ToolDetailProps, ToolTimelineStep } from "./types";

// ── Default tool component map (shared only — module-specific tools come from adapter) ──

const DEFAULT_TOOL_COMPONENTS: Record<string, ComponentType<ToolDetailProps>> = {
  fetch_web: FetchWebTool,
  browser_quick_run: BrowserQuickRunTool,
};

// ── Markdown renderer (react-markdown + GFM + syntax highlighting) ───────────

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHighlight];

const MD_COMPONENTS: Components = {
  // Unwrap <pre> so <code> can control the full block layout
  pre({ children }) {
    return <>{children}</>;
  },
  // Render images as links instead of embedding them
  img({ src }) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[11px] text-timeline-read underline break-all"
      >
        {src}
      </a>
    );
  },
  // Wrap tables in a scrollable container so wide tables scroll horizontally
  table({ children, ...props }) {
    return (
      <div className="cot-markdown-table-wrapper">
        <table {...props}>{children}</table>
      </div>
    );
  },
  code({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & ExtraProps) {
    const lang = className?.replace("language-", "");
    if (lang) {
      return (
        <div className="rounded-md border border-hairline overflow-hidden my-2">
          <div className="flex items-center px-3 py-1.5 bg-canvas-soft border-b border-hairline">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-soft">{lang}</span>
          </div>
          <div className="overflow-x-auto bg-surface-card">
            <pre className="font-mono text-[12px] leading-[1.5] text-body whitespace-pre m-0 p-3 w-fit min-w-full">
              <code className={className} {...props}>{children}</code>
            </pre>
          </div>
        </div>
      );
    }
    // Inline code
    return (
      <code
        className="font-mono text-[11px] bg-canvas-soft text-ink px-1 py-0.5 rounded border border-hairline"
        {...props}
      >
        {children}
      </code>
    );
  },
};

function CoTMarkdown({ content }: { content: string }) {
  const components = useMemo(() => MD_COMPONENTS, []);
  return (
    <div className="cot-markdown min-w-0">
      <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={components}>
        {content}
      </Markdown>
    </div>
  );
}

// ── CoT step ──────────────────────────────────────────────────────────────────

function CoTStep({
  step,
  isLive,
  isLastStep,
  adapter,
}: {
  step: TimelineStep;
  isLive?: boolean;
  isLastStep?: boolean;
  adapter?: AgentSidebarAdapter;
}) {
  const [thinkOpen, setThinkOpen] = useState(false);
  const thinkRef = useRef<HTMLDivElement>(null);
  const toolLabels = { ...DEFAULT_TOOL_LABELS, ...adapter?.toolLabels };

  // Auto-scroll think block to bottom while actively thinking
  const isThinking = step.kind === "think_block" && isLive && isLastStep;
  useEffect(() => {
    if (isThinking && thinkRef.current) {
      thinkRef.current.scrollTop = thinkRef.current.scrollHeight;
    }
  });

  const getStepStatus = (): "complete" | "active" | "pending" | "error" => {
    if (step.kind === "error") return "error";
    if (step.kind === "thinking") return "active";
    if (step.kind === "think_block") return isLive && isLastStep ? "active" : "complete";
    if (step.kind === "tool" && step.running) return "active";
    return "complete";
  };

  const getIcon = () => {
    if (step.kind === "thinking") return Brain;
    if (step.kind === "think_block") return Brain;
    if (step.kind === "code") return Code2;
    if (step.kind === "error") return XCircle;
    if (step.kind === "text") return Sparkles;
    if (step.kind === "tool") return Play;
    return Sparkles;
  };

  const getLabel = () => {
    if (step.kind === "thinking") return step.message;
    if (step.kind === "think_block") {
      if (isLive && isLastStep) return "Thinking…";
      if (step.durationMs != null) return `Thought for ${formatDuration(step.durationMs)}`;
      return "Thought process";
    }
    if (step.kind === "code") return `Code generated (${step.chars} chars)`;
    if (step.kind === "error") return step.message;
    if (step.kind === "tool") return toolLabels[step.name] || step.name;
    return null;
  };

  const status = getStepStatus();
  const Icon = getIcon();
  const label = getLabel();

  // Think block — collapsible: expanded when live, collapsed when done
  if (step.kind === "think_block") {
    const expanded = isThinking || thinkOpen;

    return (
      <div className="cot-fade-in pb-1.5">
        <button
          type="button"
          onClick={() => !isThinking && setThinkOpen(!thinkOpen)}
          className="flex items-center gap-1.5 w-full text-left bg-transparent border-none p-0"
          style={{ cursor: isThinking ? "default" : "pointer" }}
        >

          <Brain size={12} className={`shrink-0 ${isThinking ? "text-amber-500" : "text-muted-soft"}`} />
          <span className={`font-mono text-[11px] ${isThinking ? "text-muted italic" : "text-muted-soft"}`}>
            {label}
          </span>
          {!isThinking && (
            <ChevronRight
              size={11}
              className={`text-muted-soft shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            />
          )}
        </button>
        <div className="cot-collapsible" style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}>
          <div className="min-h-0 overflow-hidden">
            <div
              ref={thinkRef}
              className="mt-1 pl-6 font-mono text-[11px] leading-[1.5] text-muted-soft whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto opacity-70"
            >
              {step.content}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Text steps — render with simple code-block-aware renderer
  if (step.kind === "text") {
    return (
      <div className="py-2.5 ai-streamdown cot-fade-in">
        <CoTMarkdown content={step.message} />
      </div>
    );
  }

  // Resolve tool component — adapter overrides → defaults → fallback
  const getToolComponent = (toolStep: ToolTimelineStep): ComponentType<ToolDetailProps> => {
    return adapter?.toolComponents?.[toolStep.name] || DEFAULT_TOOL_COMPONENTS[toolStep.name] || DefaultTool;
  };

  // Adapter-provided tool components render the full step; default/fallback get header + detail
  const isFullRenderTool = step.kind === "tool" && !!adapter?.toolComponents?.[step.name];

  return (
    <div className="cot-fade-in pb-3">
      {step.kind === "tool" && isFullRenderTool ? (
        (() => {
          const ToolComponent = getToolComponent(step);
          return <ToolComponent step={step} />;
        })()
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            {status === "active" && <Loader2 size={12} className="text-amber-500 animate-spin shrink-0" />}
            <Icon size={13} className={`shrink-0 ${status === "active" ? "text-amber-500" : status === "error" ? "text-semantic-error" : "text-muted"}`} />
            <span
              className={`font-mono text-[12px] leading-[1.4] ${
                status === "error" ? "text-semantic-error" : status === "active" ? "text-body italic" : "text-body"
              }`}
            >
              {label}
            </span>
            {step.kind === "tool" && step.running && <span className="font-mono text-[11px] text-amber-500/80">Running…</span>}
            {step.kind === "tool" && !step.running && step.durationMs != null && (
              <span className="font-mono text-[11px] text-muted-soft">{formatDuration(step.durationMs)}</span>
            )}
          </div>
          {step.kind === "tool" && (() => {
            const ToolComponent = getToolComponent(step);
            return <div className="pl-5 mt-0.5"><ToolComponent step={step} /></div>;
          })()}
        </>
      )}
    </div>
  );
}

// ── Chain of Thought (flat list) ──────────────────────────────────────────────

export function ChainOfThought({
  events,
  isLive = false,
  adapter,
}: {
  events: AgentEvent[];
  isLive?: boolean;
  defaultOpen?: boolean;
  adapter?: AgentSidebarAdapter;
}) {
  const steps = eventsToTimeline(events, isLive);
  const total = steps.length;

  if (total === 0 && !isLive) return null;

  if (total === 0 && isLive) {
    return (
      <div className="flex items-center gap-2.5 py-1.5">
        <div className="cot-status-icon cot-status-active">
          <Loader2 size={14} className="text-amber-500 animate-spin" />
        </div>
        <span className="font-mono text-[11px] text-muted-soft italic">Initializing…</span>
      </div>
    );
  }

  return (
    <div className="pt-1 pb-0.5 pl-1">
      {steps.map((step, i) => {
        const key =
          step.kind === "thinking"
            ? `thinking-${i}`
            : step.kind === "think_block"
              ? `think-block-${i}`
              : step.kind === "code"
                ? `code-${i}`
                : step.kind === "tool"
                  ? `tool-${step.name}-${i}`
                  : step.kind === "text"
                    ? `text-${i}`
                    : `error-${i}`;
        return <CoTStep key={key} step={step} isLive={isLive} isLastStep={i === total - 1} adapter={adapter} />;
      })}
      {isLive &&
        steps.length > 0 &&
        (() => {
          const last = steps[steps.length - 1];
          const needsTrailing = last.kind !== "thinking" && last.kind !== "think_block" && !(last.kind === "tool" && last.running) && last.kind !== "text";
          if (!needsTrailing) return null;
          return (
            <div className="cot-fade-in pb-1.5 flex items-center gap-1.5">
              <Brain size={13} className="text-amber-500 shrink-0" />
              <span className="font-mono text-[11px] text-muted-soft italic">Thinking…</span>
            </div>
          );
        })()}
    </div>
  );
}
