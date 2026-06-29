import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { rawText } from "../timeline";
import type { ToolTimelineStep } from "../types";

/**
 * Fallback tool detail for unknown/unregistered tools.
 * Shows generic args count + raw input/output.
 */
export function DefaultTool({ step }: { step: ToolTimelineStep }) {
  const [open, setOpen] = useState(false);

  const args = step.args;
  const argsSummary = args && Object.keys(args).length > 0 ? `${Object.keys(args).length} params` : null;

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="cot-detail-toggle">
        <ChevronRight size={12} className={`text-muted-soft shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        {argsSummary && <span className="font-mono text-[11px] text-muted truncate">{argsSummary}</span>}
      </button>
      <div className="cot-collapsible" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="min-h-0 overflow-hidden">
          <div className="cot-detail-body">
            <div>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">Input</span>
              <pre className="font-mono text-[11px] leading-[1.4] text-body whitespace-pre-wrap break-all m-0 mt-0.5 max-h-[140px] overflow-y-auto">
                {args ? rawText(args) : "—"}
              </pre>
            </div>
            {!step.running && step.result != null && (
              <div>
                <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">Output</span>
                <pre className="font-mono text-[11px] leading-[1.4] text-body whitespace-pre-wrap break-all m-0 mt-0.5 max-h-[140px] overflow-y-auto">
                  {rawText(step.result)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
