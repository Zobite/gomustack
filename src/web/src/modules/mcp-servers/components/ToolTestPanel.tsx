import { AlertTriangle, CheckCircle2, Clock, Loader2, Play, RotateCcw, Terminal, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { client } from "src/lib/client";
import type { McpToolTestResult } from "src/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ToolTestPanelProps {
  serverId: string;
  toolId: string | undefined;
  code: string;
  inputSchema: string;
}

// ── Generate sample params from JSON schema ──────────────────────────────────

function generateSampleParams(schemaStr: string): string {
  try {
    const schema = JSON.parse(schemaStr);
    if (!schema.properties || Object.keys(schema.properties).length === 0) {
      return "{}";
    }

    const sample: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      const p = prop as { type?: string; description?: string };
      if (p.type === "string") sample[key] = "";
      else if (p.type === "number" || p.type === "integer") sample[key] = 0;
      else if (p.type === "boolean") sample[key] = false;
      else if (p.type === "object") sample[key] = {};
      else if (p.type === "array") sample[key] = [];
      else sample[key] = "";
    }
    return JSON.stringify(sample, null, 2);
  } catch {
    return "{}";
  }
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatResult(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ToolTestPanel({ serverId, toolId, inputSchema }: ToolTestPanelProps) {
  const [params, setParams] = useState("{}");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<McpToolTestResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ params: string; result: McpToolTestResult; timestamp: number }>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  // biome-ignore lint/correctness/useExhaustiveDependencies: params change should trigger textarea auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [params]);

  // Generate sample when schema changes
  const sampleParams = useMemo(() => generateSampleParams(inputSchema), [inputSchema]);

  // Validate JSON on change
  useEffect(() => {
    if (!params.trim() || params.trim() === "{}") {
      setParseError(null);
      return;
    }
    try {
      JSON.parse(params);
      setParseError(null);
    } catch (e) {
      setParseError((e as Error).message);
    }
  }, [params]);

  const handleTest = useCallback(async () => {
    if (!serverId || !toolId) return;
    if (parseError) return;

    setTesting(true);
    setResult(null);

    try {
      const parsedParams = JSON.parse(params || "{}");
      const testResult = await client.mcpToolServers.testTool(serverId, toolId, parsedParams, "prod");
      setResult(testResult);
      setHistory((prev) => [{ params, result: testResult, timestamp: Date.now() }, ...prev].slice(0, 10));
    } catch (err) {
      const errResult: McpToolTestResult = {
        success: false,
        result: { error: "client_error", message: (err as Error).message },
        executionTimeMs: 0,
        stdout: "",
        stderr: (err as Error).message,
      };
      setResult(errResult);
    } finally {
      setTesting(false);
    }
  }, [serverId, toolId, params, parseError]);

  const handleUseSample = useCallback(() => {
    setParams(sampleParams);
  }, [sampleParams]);

  const handleClear = useCallback(() => {
    setResult(null);
    setParams("{}");
  }, []);

  // Keyboard shortcut: Ctrl/Cmd+Enter to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleTest();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (!toolId) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="w-14 h-14 rounded-lg border border-dashed border-hairline-strong flex items-center justify-center mb-4">
          <AlertTriangle size={22} strokeWidth={1.5} className="text-muted-soft" />
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.88px] text-muted-soft font-semibold">SAVE TOOL FIRST</span>
        <span className="text-[12px] text-muted mt-2 max-w-[240px] leading-relaxed">Save the tool before testing to ensure the latest code is used.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      {/* Header */}
      <div className="shrink-0 px-3 py-3 border-b border-hairline">
        <div className="flex items-center gap-2 mb-3">
          <Terminal size={14} className="text-muted-soft" />
          <span className="font-mono text-[11px] uppercase tracking-[0.88px] text-muted-soft font-semibold">MANUAL TEST</span>
        </div>

        {/* Params editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.6px] text-muted-soft font-semibold">Input Params (JSON)</span>
            {sampleParams !== "{}" && (
              <button
                type="button"
                onClick={handleUseSample}
                className="font-mono text-[10px] text-accent-primary hover:text-accent-primary/80 bg-transparent border-none cursor-pointer p-0 transition-colors"
              >
                Use sample
              </button>
            )}
          </div>

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={params}
              onChange={(e) => setParams(e.target.value)}
              className={`w-full font-mono text-[12px] leading-[1.5] bg-surface-card text-ink px-3 py-2.5 rounded-md resize-none outline-none transition-colors border ${
                parseError ? "border-semantic-error/40 focus:border-semantic-error" : "border-hairline focus:border-hairline-strong"
              }`}
              rows={3}
              spellCheck={false}
              placeholder='{ "key": "value" }'
              style={{ minHeight: "64px", maxHeight: "200px" }}
            />
            {parseError && (
              <div className="flex items-start gap-1.5 mt-1.5">
                <XCircle size={12} className="text-semantic-error shrink-0 mt-0.5" />
                <span className="font-mono text-[11px] text-semantic-error leading-[1.4]">{parseError}</span>
              </div>
            )}
          </div>

          {/* Run & Clear buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !!parseError}
              className="flex-1 flex items-center justify-center gap-2 h-[34px] rounded-md bg-ink text-canvas font-mono text-[12px] font-medium cursor-pointer border-none hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {testing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play size={13} />
                  Execute
                </>
              )}
            </button>
            {result && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center justify-center w-[34px] h-[34px] rounded-md bg-transparent border border-hairline text-muted hover:text-ink hover:border-hairline-strong cursor-pointer transition-colors"
                title="Clear result"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>

          <div className="font-mono text-[10px] text-muted-soft text-center">⌘+Enter to run</div>
        </div>
      </div>

      {/* Result area */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!result && !testing && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-lg border border-dashed border-hairline-strong flex items-center justify-center mb-3">
              <Play size={20} strokeWidth={1.5} className="text-muted-soft" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.88px] text-muted-soft">READY TO TEST</span>
            <span className="text-[12px] text-muted mt-1.5 max-w-[220px] leading-relaxed">Set params and click Execute to test the tool</span>
          </div>
        )}

        {testing && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 size={24} className="text-muted-soft animate-spin" />
            <span className="font-mono text-[11px] text-muted-soft uppercase tracking-wide">Executing…</span>
          </div>
        )}

        {result && !testing && (
          <div className="space-y-3">
            {/* Status header */}
            <div
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${
                result.success ? "bg-semantic-success/5 border-semantic-success/20" : "bg-semantic-error/5 border-semantic-error/20"
              }`}
            >
              {result.success ? (
                <CheckCircle2 size={16} className="text-semantic-success shrink-0" />
              ) : (
                <XCircle size={16} className="text-semantic-error shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={`font-mono text-[12px] font-semibold ${result.success ? "text-semantic-success" : "text-semantic-error"}`}>
                  {result.success ? "Success" : "Error"}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Clock size={11} className="text-muted-soft" />
                <span className="font-mono text-[11px] text-muted-soft tabular-nums">{formatMs(result.executionTimeMs)}</span>
              </div>
            </div>

            {/* Result output */}
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.6px] text-muted-soft font-semibold">Result</span>
              <pre className="mt-1.5 font-mono text-[11px] leading-[1.5] text-ink whitespace-pre-wrap break-words bg-surface-card border border-hairline rounded-md px-3 py-2.5 m-0 max-h-[300px] overflow-y-auto">
                {formatResult(result.result)}
              </pre>
            </div>

            {/* Stdout */}
            {result.stdout && (
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.6px] text-muted-soft font-semibold">Console Output</span>
                <pre className="mt-1.5 font-mono text-[11px] leading-[1.5] text-muted whitespace-pre-wrap break-words bg-canvas-soft border border-hairline rounded-md px-3 py-2.5 m-0 max-h-[150px] overflow-y-auto">
                  {result.stdout}
                </pre>
              </div>
            )}

            {/* Stderr */}
            {result.stderr && (
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.6px] text-semantic-error font-semibold">Error Output</span>
                <pre className="mt-1.5 font-mono text-[11px] leading-[1.5] text-semantic-error whitespace-pre-wrap break-words bg-semantic-error/5 border border-semantic-error/20 rounded-md px-3 py-2.5 m-0 max-h-[150px] overflow-y-auto">
                  {result.stderr}
                </pre>
              </div>
            )}

            {/* History */}
            {history.length > 1 && (
              <div className="pt-2 border-t border-hairline">
                <span className="font-mono text-[10px] uppercase tracking-[0.6px] text-muted-soft font-semibold">Recent Runs ({history.length})</span>
                <div className="mt-1.5 space-y-1">
                  {history.map((h, i) => (
                    <button
                      type="button"
                      key={`history-${h.timestamp}`}
                      onClick={() => {
                        setParams(h.params);
                        setResult(h.result);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left border-none cursor-pointer transition-colors ${
                        i === 0 ? "bg-surface-card" : "bg-transparent hover:bg-canvas-soft"
                      }`}
                    >
                      {h.result.success ? (
                        <CheckCircle2 size={11} className="text-semantic-success shrink-0" />
                      ) : (
                        <XCircle size={11} className="text-semantic-error shrink-0" />
                      )}
                      <span className="font-mono text-[11px] text-muted truncate flex-1">{h.params.length > 40 ? `${h.params.slice(0, 40)}…` : h.params}</span>
                      <span className="font-mono text-[10px] text-muted-soft tabular-nums shrink-0">{formatMs(h.result.executionTimeMs)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
