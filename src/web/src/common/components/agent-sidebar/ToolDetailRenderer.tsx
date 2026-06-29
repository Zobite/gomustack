import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { formatDuration, rawText } from "./timeline";
import type { ToolTimelineStep } from "./types";

// ── Default Test Result Detail ────────────────────────────────────────────────

export function DefaultTestResultDetail({ result }: { result: Record<string, unknown> }) {
  const success = result.success as boolean | undefined;
  const stdout = result.stdout as string | undefined;
  const stderr = result.stderr as string | undefined;
  const body = result.result;
  const execTime = result.executionTimeMs as number | undefined;

  return (
    <div className="space-y-1 mt-1">
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span className={success ? "text-muted-soft" : "text-semantic-error font-semibold"}>{success ? "Executed" : "Runtime Error"}</span>
        {execTime != null && <span className="text-muted-soft">{formatDuration(execTime)}</span>}
      </div>
      {stderr && (
        <pre className="font-mono text-[11px] leading-[1.4] text-semantic-error whitespace-pre-wrap break-all m-0 overflow-y-auto">
          {rawText(stderr)}
        </pre>
      )}
      {body != null && (
        <pre className="font-mono text-[11px] leading-[1.4] text-body whitespace-pre-wrap break-all m-0 overflow-y-auto">
          {rawText(body)}
        </pre>
      )}
      {stdout && <div className="font-mono text-[11px] text-muted-soft">stdout: {rawText(stdout)}</div>}
    </div>
  );
}

// ── Default Tool Detail (collapsible) ─────────────────────────────────────────

export function DefaultToolDetail({
  step,
  renderTestResult,
  argsSummary: argsSummaryOverride,
  resultSummary: resultSummaryOverride,
  resultBadge,
}: {
  step: ToolTimelineStep;
  renderTestResult?: (result: Record<string, unknown>) => React.ReactNode;
  argsSummary?: string | null;
  resultSummary?: string | null;
  resultBadge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const argsSummary =
    argsSummaryOverride !== undefined
      ? argsSummaryOverride
      : (() => {
          const args = step.args;
          if (!args || Object.keys(args).length === 0) return null;
          if (step.name === "write_code") {
            if (args.code && typeof args.code === "string") return args.code;
            return null;
          }
          if (step.name === "fetch_web") {
            const url = (args.url as string) || "";
            const hdrs = args.headers as Record<string, string> | undefined;
            const hdrCount = hdrs ? Object.keys(hdrs).length : 0;
            return hdrCount > 0 ? `${url} (+${hdrCount} headers)` : url;
          }
          return `${Object.keys(args).length} params`;
        })();

  const resultSummary =
    resultSummaryOverride !== undefined
      ? resultSummaryOverride
      : (() => {
          if (step.running || step.result == null) return null;
          if (step.name === "run_test" && typeof step.result === "object") {
            const r = step.result as Record<string, unknown>;
            return r.success ? "✓ passed" : "⚠ failed";
          }
          return null;
        })();

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="cot-detail-toggle">
        <ChevronRight size={12} className={`text-muted-soft shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        {argsSummary && <span className="font-mono text-[11px] text-muted truncate">{argsSummary}</span>}
        {resultSummary && !step.running && (
          <>
            <span className="text-muted-soft text-[11px]">→</span>
            <span
              className={`font-mono text-[11px] ${step.name === "run_test" && step.result && !(step.result as Record<string, unknown>).success ? "text-semantic-error font-semibold" : "text-muted-soft"}`}
            >
              {resultSummary}
            </span>
          </>
        )}
        {resultBadge}
      </button>

      <div className="cot-collapsible" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="min-h-0 overflow-hidden">
          <div className="cot-detail-body">
            <div>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">Input</span>
              <pre className="font-mono text-[11px] leading-[1.4] text-body whitespace-pre-wrap break-all m-0 mt-0.5 max-h-[140px] overflow-y-auto">
                {step.args ? rawText(step.args) : "—"}
              </pre>
            </div>
            {!step.running && step.result != null && (
              <div>
                <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">Output</span>
                {step.name === "run_test" && typeof step.result === "object" ? (
                  renderTestResult ? (
                    renderTestResult(step.result as Record<string, unknown>)
                  ) : (
                    <DefaultTestResultDetail result={step.result as Record<string, unknown>} />
                  )
                ) : (
                  <pre className="font-mono text-[11px] leading-[1.4] text-body whitespace-pre-wrap break-all m-0 mt-0.5 max-h-[140px] overflow-y-auto">
                    {rawText(step.result)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
