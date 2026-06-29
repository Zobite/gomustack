import { Spin } from "antd";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import type { DynamicApiLogItem } from "src/lib/types";

interface LogsPanelProps {
  logs: DynamicApiLogItem[];
  loading: boolean;
  onRefresh: () => void;
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function formatHeaders(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return Object.entries(parsed)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
  } catch {
    return raw;
  }
}

export function LogsPanel({ logs, loading, onRefresh }: LogsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spin />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-soft">
        <Clock size={24} strokeWidth={1.5} className="mb-2" />
        <span className="font-mono text-[11px] uppercase tracking-wider">No logs yet</span>
      </div>
    );
  }

  return (
    <div className="space-y-1 overflow-y-auto pb-6 px-5" style={{ maxHeight: "calc(100vh - 300px)" }}>
      <div className="flex justify-end mb-2">
        <button
          onClick={onRefresh}
          className="font-mono text-[10px] text-muted-soft uppercase tracking-wider hover:text-ink cursor-pointer bg-transparent border-none"
        >
          ↻ Refresh
        </button>
      </div>
      {logs.map((log) => {
        const isExpanded = expandedId === log.id;
        return (
          <div key={log.id} className="border border-hairline rounded-md overflow-hidden">
            <div
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-canvas transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : log.id)}
            >
              <span className="text-muted-soft shrink-0">{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
              <span className="font-mono text-[11px] font-semibold" style={{ color: log.statusCode < 400 ? "#1f8a65" : "#cf2d56" }}>
                {log.statusCode}
              </span>
              <span className="font-mono text-[11px] text-muted">{log.method}</span>
              <span className="font-mono text-[11px] text-ink truncate flex-1">{log.path}</span>
              <span className="font-mono text-[10px] text-muted-soft">{log.executionTimeMs}ms</span>
              <span className="font-mono text-[10px] text-muted-soft">{new Date(log.createdAt).toLocaleTimeString()}</span>
            </div>

            {isExpanded && (
              <div className="px-3 py-2 border-t border-hairline bg-canvas space-y-2.5">
                {/* IP address */}
                {log.ip && (
                  <div>
                    <div className="font-mono text-[9px] text-muted-soft uppercase tracking-wider mb-1">IP Address</div>
                    <div className="font-mono text-[11px] text-ink">{log.ip}</div>
                  </div>
                )}

                {/* Request headers */}
                {log.requestHeaders && (
                  <div>
                    <div className="font-mono text-[9px] text-muted-soft uppercase tracking-wider mb-1">Request Headers</div>
                    <pre className="font-mono text-[11px] text-[#d4d4d4] bg-[#1e1e1e] p-2 rounded m-0 whitespace-pre-wrap max-h-[150px] overflow-auto">
                      {formatHeaders(log.requestHeaders)}
                    </pre>
                  </div>
                )}

                {/* Request body */}
                {log.requestBody && (
                  <div>
                    <div className="font-mono text-[9px] text-muted-soft uppercase tracking-wider mb-1">Request Body</div>
                    <pre className="font-mono text-[11px] text-[#d4d4d4] bg-[#1e1e1e] p-2 rounded m-0 whitespace-pre-wrap max-h-[200px] overflow-auto">
                      {formatJson(log.requestBody)}
                    </pre>
                  </div>
                )}

                {/* Console output */}
                {log.consoleOutput && (
                  <div>
                    <div className="font-mono text-[9px] text-muted-soft uppercase tracking-wider mb-1">Console Output</div>
                    <pre className="font-mono text-[11px] text-[#a5b4fc] bg-[#1a1a2e] p-2 rounded m-0 whitespace-pre-wrap max-h-[200px] overflow-auto">
                      {log.consoleOutput}
                    </pre>
                  </div>
                )}

                {/* Response body */}
                {log.responseBody && (
                  <div>
                    <div className="font-mono text-[9px] text-muted-soft uppercase tracking-wider mb-1">Response Body</div>
                    <pre className="font-mono text-[11px] text-ink bg-surface-card p-2 rounded m-0 whitespace-pre-wrap border border-hairline max-h-[200px] overflow-auto">
                      {formatJson(log.responseBody)}
                    </pre>
                  </div>
                )}

                {/* Error stacktrace */}
                {log.error && (
                  <div>
                    <div className="font-mono text-[9px] text-red-400 uppercase tracking-wider mb-1">Error Stacktrace</div>
                    <pre className="font-mono text-[11px] text-[#fca5a5] bg-[#2a0a0a] p-2 rounded m-0 whitespace-pre-wrap max-h-[200px] overflow-auto">
                      {log.error}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
