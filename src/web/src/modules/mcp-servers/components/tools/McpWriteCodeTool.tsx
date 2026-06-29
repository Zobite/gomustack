import { CheckCircle2, Code2, Loader2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDuration, rawText } from "src/common/components/agent-sidebar/timeline";
import type { ToolDetailProps } from "src/common/components/agent-sidebar/types";

type Tab = "code" | "result";

/**
 * MCP write_code tool — Postman-inspired card showing code content and save result.
 */
export function McpWriteCodeTool({ step }: ToolDetailProps) {
  const code = typeof step.args?.code === "string" ? step.args.code : "";
  const filePath = typeof step.args?.path === "string" ? step.args.path : null;
  const result = step.result as Record<string, unknown> | undefined;
  const hasResult = !step.running && result != null;
  const saved = hasResult && result?.success !== false;
  const [tab, setTab] = useState<Tab>(hasResult ? "result" : "code");

  return (
    <div className="rounded-md border border-hairline overflow-hidden bg-surface-card">
      {/* ── Header row ── */}
      <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-hairline">
        {step.running ? (
          <Loader2 size={12} className="text-amber-500 animate-spin shrink-0" />
        ) : (
          <Code2 size={13} className="text-muted shrink-0" />
        )}
        <span className="font-mono text-[12px] text-body leading-[1.4] truncate">
          {filePath ? fileName(filePath) : "Write code"}
        </span>
        {step.running && <span className="font-mono text-[11px] text-amber-500/80">Saving…</span>}
        {hasResult && (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              color: saved ? "var(--color-semantic-success)" : "var(--color-semantic-error)",
              background: saved ? "hsl(142 71% 45% / 0.1)" : "hsl(346 70% 44% / 0.1)",
            }}
          >
            {saved ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
            {saved ? "SAVED" : "FAIL"}
          </span>
        )}
        <span className="font-mono text-[11px] text-muted-soft ml-auto flex items-center gap-1.5">
          <CodeSize chars={code.length} />
          {hasResult && step.durationMs != null && (
            <>
              <span className="text-muted-soft/50">·</span>
              {formatDuration(step.durationMs)}
            </>
          )}
        </span>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-hairline bg-canvas-soft">
        <TabButton label="Code" active={tab === "code"} onClick={() => setTab("code")} />
        {hasResult && (
          <TabButton label="Result" active={tab === "result"} onClick={() => setTab("result")} />
        )}
      </div>

      {/* ── Tab content ── */}
      <div className="p-2.5">
        {tab === "code" && <CodePanel code={code} filePath={filePath} />}
        {tab === "result" && hasResult && <ResultPanel result={result} />}
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

// ── Code panel ─────────────────────────────────────────────────────────────────

function CodePanel({ code, filePath }: { code: string; filePath: string | null }) {
  const ext = filePath ? filePath.split(".").pop() || "" : "";

  return (
    <div className="space-y-1.5">
      {filePath && (
        <div>
          <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">Path</span>
          <div className="font-mono text-[11px] text-body leading-[1.4] mt-0.5 truncate">{filePath}</div>
        </div>
      )}
      <div>
        <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">
          Code {ext && <span className="normal-case text-muted-soft/60">({ext})</span>}
        </span>
        <CodePreview code={code} />
      </div>
    </div>
  );
}

// ── Code preview with line numbers ─────────────────────────────────────────────

function CodePreview({ code }: { code: string }) {
  const preview = rawText(code, 1200);
  const lines = useMemo(() => preview.split("\n"), [preview]);

  if (!code) {
    return <span className="font-mono text-[11px] text-muted-soft italic">No code</span>;
  }

  return (
    <div className="relative mt-0.5 rounded bg-canvas-soft border border-hairline-soft overflow-hidden">
      <div className="max-h-[180px] overflow-y-auto">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <tbody>
            {lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines are derived from a static string split, order is stable
              <tr key={i}>
                <td
                  className="text-right select-none font-mono text-[10px] text-muted-soft/50 align-top px-1.5"
                  style={{ width: "28px", userSelect: "none" }}
                >
                  {i + 1}
                </td>
                <td className="font-mono text-[11px] text-body leading-[1.5] whitespace-pre-wrap break-all pr-1.5">
                  {line}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Result panel ───────────────────────────────────────────────────────────────

function ResultPanel({ result }: { result: Record<string, unknown> }) {
  const message = result.message as string | undefined;
  const error = result.error as string | undefined;
  const body = result.result;

  return (
    <div className="space-y-2">
      {error && (
        <OutputBlock label="ERROR" variant="error">
          {rawText(error)}
        </OutputBlock>
      )}
      {message && (
        <OutputBlock label="MESSAGE" variant="default">
          {rawText(message)}
        </OutputBlock>
      )}
      {body != null && (
        <OutputBlock label="RESULT" variant="default">
          {rawText(body)}
        </OutputBlock>
      )}
      {!error && !message && body == null && (
        <span className="font-mono text-[11px] text-muted-soft italic">✓ File saved successfully</span>
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function fileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function CodeSize({ chars }: { chars: number }) {
  if (chars === 0) return null;
  if (chars < 1000) return <span>{chars} chars</span>;
  return <span>{(chars / 1000).toFixed(1)}k chars</span>;
}
