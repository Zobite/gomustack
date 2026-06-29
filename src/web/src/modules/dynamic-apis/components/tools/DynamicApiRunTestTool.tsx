import { CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { useState } from "react";
import { formatDuration, rawText } from "src/common/components/agent-sidebar/timeline";
import type { ToolTimelineStep } from "src/common/components/agent-sidebar/types";

type Tab = "request" | "response";

/**
 * Custom run_test tool for Dynamic API — Postman-inspired full-render component.
 */
export function DynamicApiRunTestTool({ step }: { step: ToolTimelineStep }) {
  const args = step.args;
  const result = step.result as Record<string, unknown> | undefined;
  const httpStatus = result?.status as number | undefined;
  const hasError = !!result?.error;
  const hasResult = !step.running && result != null;
  const passed = hasResult && !hasError && httpStatus != null && httpStatus < 400;

  const [tab, setTab] = useState<Tab>(hasResult ? "response" : "request");

  return (
    <div className="rounded-md border border-hairline overflow-hidden bg-surface-card">
      {/* ── Header row ── */}
      <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-hairline">
        {step.running ? (
          <Loader2 size={12} className="text-amber-500 animate-spin shrink-0" />
        ) : (
          <Play size={13} className="text-muted shrink-0" />
        )}
        <span className="font-mono text-[12px] text-body leading-[1.4]">Run test</span>
        {step.running && <span className="font-mono text-[11px] text-amber-500/80">Running…</span>}
        {hasResult && (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              color: passed ? "var(--color-semantic-success)" : "var(--color-semantic-error)",
              background: passed ? "hsl(142 71% 45% / 0.1)" : "hsl(346 70% 44% / 0.1)",
            }}
          >
            {passed ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
            {passed ? "PASS" : "FAIL"}
            {httpStatus != null && <span className="font-normal text-muted-soft">{httpStatus}</span>}
          </span>
        )}
        {hasResult && step.durationMs != null && (
          <span className="font-mono text-[11px] text-muted-soft ml-auto">{formatDuration(step.durationMs)}</span>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-hairline bg-canvas-soft">
        <TabButton label="Request" active={tab === "request"} onClick={() => setTab("request")} />
        {hasResult && (
          <TabButton label="Response" active={tab === "response"} onClick={() => setTab("response")} />
        )}
      </div>

      {/* ── Tab content ── */}
      <div className="p-2.5">
        {tab === "request" && <RequestPanel args={args} />}
        {tab === "response" && hasResult && <ResponsePanel result={result} />}
      </div>
    </div>
  );
}

// ── Tab button ─────────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-transparent border-none cursor-pointer font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 transition-colors duration-150"
      style={{
        color: active ? "var(--color-ink)" : "var(--color-muted-soft)",
        fontWeight: active ? 600 : 400,
        borderBottom: active ? "2px solid var(--color-accent-orange)" : "2px solid transparent",
        marginBottom: "-1px",
      }}
    >
      {label}
    </button>
  );
}

// ── Request panel ──────────────────────────────────────────────────────────────

function RequestPanel({ args }: { args?: Record<string, unknown> }) {
  if (!args || Object.keys(args).length === 0) {
    return <span className="font-mono text-[11px] text-muted-soft italic">No parameters</span>;
  }

  return (
    <div className="space-y-1.5">
      {Object.entries(args).map(([key, value]) => {
        const display = typeof value === "string" ? value : JSON.stringify(value, null, 2);
        const isLong = display.length > 80 || display.includes("\n");
        return (
          <div key={key}>
            <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">{key}</span>
            {isLong ? (
              <pre className="font-mono text-[11px] text-body leading-[1.4] whitespace-pre-wrap break-all m-0 mt-0.5 max-h-[120px] overflow-y-auto rounded bg-canvas-soft p-1.5 border border-hairline-soft">
                {display}
              </pre>
            ) : (
              <div className="font-mono text-[11px] text-body leading-[1.4] mt-0.5">{display}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Response panel ─────────────────────────────────────────────────────────────

function ResponsePanel({ result }: { result: Record<string, unknown> }) {
  const error = result.error as string | undefined;
  const body = result.body;
  const logs = result.consoleLogs as string[] | undefined;

  return (
    <div className="space-y-2">
      {error && (
        <OutputBlock label="ERROR" variant="error">
          {rawText(error, 500)}
        </OutputBlock>
      )}
      {body != null && !error && (
        <OutputBlock label="BODY" variant="default">
          {rawText(body, 500)}
        </OutputBlock>
      )}
      {logs && logs.length > 0 && (
        <OutputBlock label="CONSOLE" variant="muted">
          {logs.join("\n")}
        </OutputBlock>
      )}
    </div>
  );
}

// ── Output block ───────────────────────────────────────────────────────────────

function OutputBlock({
  label,
  variant,
  children,
}: {
  label: string;
  variant: "default" | "error" | "muted";
  children: string;
}) {
  const textColor =
    variant === "error"
      ? "var(--color-semantic-error)"
      : variant === "muted"
        ? "var(--color-muted)"
        : "var(--color-body)";

  return (
    <div>
      <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-muted-soft">{label}</span>
      <pre
        className="font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all m-0 mt-0.5 max-h-[160px] overflow-y-auto rounded bg-canvas-soft p-1.5 border border-hairline-soft"
        style={{ color: textColor }}
      >
        {children}
      </pre>
    </div>
  );
}
