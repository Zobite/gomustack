import { CheckCircle2, ChevronRight, Globe, MousePointer2, Keyboard, Camera, Code2, Eye, Clock, ArrowDown, ListChecks, Navigation, Hand, Loader2, XCircle, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { formatDuration, rawText } from "../timeline";
import type { ToolDetailProps } from "../types";

// ── Step action metadata ──────────────────────────────────────────────────────

const ACTION_META: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  navigate: { icon: Navigation, label: "Navigate", color: "text-blue-400" },
  click: { icon: MousePointer2, label: "Click", color: "text-amber-400" },
  type: { icon: Keyboard, label: "Type", color: "text-emerald-400" },
  screenshot: { icon: Camera, label: "Screenshot", color: "text-purple-400" },
  get_content: { icon: Code2, label: "Get Content", color: "text-cyan-400" },
  eval: { icon: Code2, label: "Eval JS", color: "text-orange-400" },
  wait: { icon: Clock, label: "Wait", color: "text-yellow-400" },
  sleep: { icon: Clock, label: "Sleep", color: "text-yellow-400" },
  scroll: { icon: ArrowDown, label: "Scroll", color: "text-muted" },
  select: { icon: ListChecks, label: "Select", color: "text-emerald-400" },
  press_key: { icon: Keyboard, label: "Press Key", color: "text-emerald-400" },
  hover: { icon: Hand, label: "Hover", color: "text-amber-400" },
  extract_text: { icon: Eye, label: "Extract Text", color: "text-cyan-400" },
  get_snapshot: { icon: Eye, label: "Get Snapshot", color: "text-cyan-400" },
  get_interactive_elements: { icon: ListChecks, label: "Interactive Elements", color: "text-purple-400" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrowserStep {
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
}

interface StepResult {
  stepIndex?: number;
  action?: string;
  success?: boolean;
  result?: unknown;
  error?: string;
  url?: string;
  title?: string;
}

type Tab = "steps" | "results";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStepSummary(step: BrowserStep): string {
  switch (step.action) {
    case "navigate":
      return step.url || "—";
    case "click":
      return step.text || step.selector || "—";
    case "type":
      return `${step.selector || "—"} → "${step.text || ""}"`;
    case "screenshot":
      return "Capture page";
    case "get_content":
      return "Get HTML";
    case "eval":
      return step.code ? `${step.code.slice(0, 60)}${step.code.length > 60 ? "…" : ""}` : "—";
    case "wait":
      return step.selector || step.text || "—";
    case "sleep":
      return step.timeout ? `${step.timeout}ms` : "—";
    case "scroll":
      return `${step.direction || "down"}${step.amount ? ` ${step.amount}px` : ""}`;
    case "select":
      return `${step.selector || "—"} → ${step.value || "—"}`;
    case "press_key":
      return step.key || "—";
    case "hover":
      return step.selector || step.text || "—";
    case "extract_text":
      return step.selector || "—";
    case "get_snapshot":
      return "Accessibility tree";
    case "get_interactive_elements":
      return "List elements";
    default:
      return step.action;
  }
}

/** Extract the first URL from steps (for address bar display) */
function extractUrl(steps: BrowserStep[]): string | null {
  for (const s of steps) {
    if (s.action === "navigate" && s.url) return s.url;
  }
  return null;
}

// ── Tab button ────────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-transparent border-none cursor-pointer font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 transition-colors duration-150"
      style={{
        color: active ? "var(--color-ink)" : "var(--color-muted-soft)",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

// ── Step result item (in results tab) ─────────────────────────────────────────

function StepResultItem({ result, index }: { result: StepResult; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const action = result.action || `step_${index + 1}`;
  const meta = ACTION_META[action] || { icon: Globe, label: action, color: "text-muted" };
  const Icon = meta.icon;
  const hasDetail = result.result != null || result.error;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => hasDetail && setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left bg-transparent border-none p-0 py-1"
        style={{ cursor: hasDetail ? "pointer" : "default" }}
      >
        <span className="font-mono text-[10px] text-muted-soft/50 w-3 text-right shrink-0">{index + 1}</span>
        {result.success === false ? (
          <XCircle size={11} className="text-semantic-error shrink-0" />
        ) : result.success === true ? (
          <CheckCircle2 size={11} className="text-semantic-success shrink-0" />
        ) : (
          <Icon size={11} className={`${meta.color} shrink-0`} />
        )}
        <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider shrink-0">{meta.label}</span>
        {result.error && (
          <span className="font-mono text-[10px] text-semantic-error truncate">{result.error}</span>
        )}
        {!result.error && result.url && (
          <span className="font-mono text-[10px] text-muted truncate">{result.url}</span>
        )}
        {hasDetail && (
          <ChevronRight
            size={10}
            className={`text-muted-soft shrink-0 transition-transform duration-200 ml-auto ${expanded ? "rotate-90" : ""}`}
          />
        )}
      </button>
      {expanded && hasDetail && (
        <pre className="font-mono text-[10px] leading-[1.4] text-body whitespace-pre-wrap break-all m-0 ml-7 mb-1 max-h-[120px] overflow-y-auto rounded bg-canvas-soft p-1.5 border border-hairline-soft">
          {result.error ? result.error : rawText(result.result, 800)}
        </pre>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BrowserQuickRunTool({ step }: ToolDetailProps) {
  const steps = (step.args?.steps as BrowserStep[]) || [];
  const stepCount = steps.length;
  const targetUrl = extractUrl(steps);

  // Parse result
  const resultData = step.result as { steps?: StepResult[]; results?: StepResult[]; error?: string } | StepResult[] | string | null | undefined;
  let stepResults: StepResult[] = [];
  let topError: string | undefined;

  if (Array.isArray(resultData)) {
    stepResults = resultData;
  } else if (resultData && typeof resultData === "object") {
    stepResults = resultData.steps || resultData.results || [];
    topError = resultData.error;
  }

  const hasResult = !step.running && (stepResults.length > 0 || topError || step.result != null);
  const allPassed = stepResults.length > 0 && stepResults.every((r) => r.success !== false);
  const hasFail = stepResults.some((r) => r.success === false) || !!topError;
  const [tab, setTab] = useState<Tab>(hasResult ? "results" : "steps");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-md border border-hairline overflow-hidden bg-surface-card">
      {/* ── Browser chrome header (clickable) ── */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 px-2.5 py-2 w-full text-left bg-transparent border-none cursor-pointer"
        style={{ background: "var(--color-canvas-soft)" }}
      >
        {/* Address bar */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 rounded-md px-2 py-1 border border-hairline" style={{ background: "var(--color-surface-card)" }}>
          {step.running ? (
            <Loader2 size={10} className="text-amber-500 animate-spin shrink-0" />
          ) : (
            <Globe size={10} className="text-muted-soft shrink-0" />
          )}
          <span className="font-mono text-[10px] text-muted truncate">
            {targetUrl || `${stepCount} step${stepCount > 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Status badge */}
        {step.running && <span className="font-mono text-[10px] text-amber-500/80 shrink-0">Running…</span>}
        {hasResult && (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
            style={{
              color: hasFail ? "var(--color-semantic-error)" : "var(--color-semantic-success)",
              background: hasFail ? "hsl(346 70% 44% / 0.1)" : "hsl(142 71% 45% / 0.1)",
            }}
          >
            {hasFail ? <XCircle size={10} /> : <CheckCircle2 size={10} />}
            {hasFail ? "FAIL" : allPassed ? "DONE" : `${stepResults.length} steps`}
          </span>
        )}
        {hasResult && step.durationMs != null && (
          <span className="font-mono text-[10px] text-muted-soft shrink-0">{formatDuration(step.durationMs)}</span>
        )}
      </button>

      {/* ── Body (collapsible) ── */}
      {!collapsed && (
        <>
          {/* ── Tabs ── */}
          <div className="flex border-t border-hairline bg-canvas-soft">
            <TabButton label="Steps" active={tab === "steps"} onClick={() => setTab("steps")} />
            {hasResult && (
              <TabButton label="Results" active={tab === "results"} onClick={() => setTab("results")} />
            )}
          </div>

          {/* ── Tab content ── */}
          <div className="p-2.5">
            {tab === "steps" && <StepsPanel steps={steps} />}
            {tab === "results" && hasResult && (
              <ResultsPanel stepResults={stepResults} topError={topError} rawResult={step.result} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Steps panel ───────────────────────────────────────────────────────────────

function StepsPanel({ steps }: { steps: BrowserStep[] }) {
  if (steps.length === 0) {
    return <span className="font-mono text-[11px] text-muted-soft italic">No steps</span>;
  }

  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => {
        const meta = ACTION_META[s.action] || { icon: Globe, label: s.action, color: "text-muted" };
        return (
          <div key={`step-${s.action}-${i}`}>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-soft/50 w-3 text-right shrink-0">{i + 1}</span>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">
                {meta.label}
              </span>
            </div>
            <div className="font-mono text-[11px] text-body leading-[1.4] mt-0.5 ml-[18px] break-all">{getStepSummary(s)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Results panel ─────────────────────────────────────────────────────────────

function ResultsPanel({ stepResults, topError, rawResult }: { stepResults: StepResult[]; topError?: string; rawResult?: unknown }) {
  return (
    <div className="space-y-1.5">
      {topError && (
        <div>
          <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-semantic-error">ERROR</span>
          <pre className="font-mono text-[11px] leading-[1.5] text-semantic-error whitespace-pre-wrap break-all m-0 mt-0.5 max-h-[100px] overflow-y-auto rounded bg-canvas-soft p-1.5 border border-hairline-soft">
            {topError}
          </pre>
        </div>
      )}
      {stepResults.length > 0 && (
        <div className="space-y-0">
          {stepResults.map((r, i) => (
            <StepResultItem key={`result-${r.action || "step"}-${i}`} result={r} index={i} />
          ))}
        </div>
      )}
      {stepResults.length === 0 && !topError && rawResult != null && (
        <div>
          <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-muted-soft">RAW</span>
          <pre className="font-mono text-[11px] leading-[1.5] text-body whitespace-pre-wrap break-all m-0 mt-0.5 max-h-[140px] overflow-y-auto rounded bg-canvas-soft p-1.5 border border-hairline-soft">
            {rawText(rawResult)}
          </pre>
        </div>
      )}
    </div>
  );
}
