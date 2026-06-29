import { Loader2 } from "lucide-react";
import { useState } from "react";
import { formatDuration, rawText } from "../timeline";
import type { ToolDetailProps } from "../types";

type Tab = "request" | "response";

/**
 * FetchWebTool — Minimal HTTP request card for fetch_web tool calls.
 */
export function FetchWebTool({ step }: ToolDetailProps) {
  const url = (step.args?.url as string) || "";
  const mode = (step.args?.mode as string) || "raw";
  const hdrs = step.args?.headers as Record<string, string> | undefined;
  const hdrCount = hdrs ? Object.keys(hdrs).length : 0;

  const result = step.result;
  const hasResult = !step.running && result != null;
  const isError = hasResult && typeof result === "string" && (result.startsWith("HTTP Error") || result.startsWith("Fetch error"));
  const [tab, setTab] = useState<Tab>(hasResult ? "response" : "request");

  return (
    <div className="rounded-md border border-hairline overflow-hidden bg-surface-card">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-hairline">
        {step.running && <Loader2 size={11} className="text-amber-500 animate-spin shrink-0" />}
        <span className="font-mono text-[11px] text-body truncate min-w-0">{url || "—"}</span>
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {step.running && <span className="font-mono text-[10px] text-amber-500/80">Fetching…</span>}
          {hasResult && step.durationMs != null && <span className="font-mono text-[10px] text-muted-soft">{formatDuration(step.durationMs)}</span>}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-canvas-soft">
        <TabButton label="Request" active={tab === "request"} onClick={() => setTab("request")} />
        {hasResult && <TabButton label="Response" active={tab === "response"} onClick={() => setTab("response")} />}
      </div>

      {/* ── Content ── */}
      <div className="p-2.5">
        {tab === "request" && <RequestPanel url={url} mode={mode} headers={hdrs} hdrCount={hdrCount} />}
        {tab === "response" && hasResult && <ResponsePanel result={result} isError={isError} />}
      </div>
    </div>
  );
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

// ── Request panel ─────────────────────────────────────────────────────────────

function RequestPanel({ url, mode, headers, hdrCount }: { url: string; mode: string; headers?: Record<string, string>; hdrCount: number }) {
  return (
    <div className="space-y-1.5">
      <div>
        <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">URL</span>
        <div className="font-mono text-[11px] text-body leading-[1.4] mt-0.5 break-all">{url || "—"}</div>
      </div>
      {mode !== "raw" && (
        <div>
          <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">Mode</span>
          <div className="font-mono text-[11px] text-body leading-[1.4] mt-0.5">{mode}</div>
        </div>
      )}
      {hdrCount > 0 && headers && (
        <div>
          <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">Headers</span>
          <pre className="font-mono text-[11px] leading-[1.4] text-body whitespace-pre-wrap break-all m-0 mt-0.5 max-h-[100px] overflow-y-auto rounded bg-canvas-soft p-1.5 border border-hairline-soft">
            {Object.entries(headers)
              .map(([k, v]) => `${k}: ${v}`)
              .join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Response panel ────────────────────────────────────────────────────────────

function ResponsePanel({ result, isError }: { result: unknown; isError: boolean }) {
  return (
    <pre
      className="font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all m-0 max-h-[200px] overflow-y-auto"
      style={{ color: isError ? "var(--color-semantic-error)" : "var(--color-body)" }}
    >
      {rawText(result, 2000)}
    </pre>
  );
}
