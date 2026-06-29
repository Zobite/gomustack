import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { rawText } from "src/common/components/agent-sidebar/timeline";
import type { ToolDetailProps } from "src/common/components/agent-sidebar/types";

/**
 * Dynamic API write_code tool — shows code length and saved status.
 */
export function DynamicApiWriteCodeTool({ step }: ToolDetailProps) {
  const [open, setOpen] = useState(false);
  const codeLen = typeof step.args?.code === "string" ? step.args.code.length : 0;
  const saved = !step.running && step.result != null;

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="cot-detail-toggle">
        <ChevronRight size={12} className={`text-muted-soft shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        <span className="font-mono text-[11px] text-muted truncate">{codeLen} chars</span>
        {saved && (
          <>
            <span className="text-muted-soft text-[11px]">→</span>
            <span className="font-mono text-[11px] text-muted-soft">✓ saved</span>
          </>
        )}
      </button>
      <div className="cot-collapsible" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="min-h-0 overflow-hidden">
          <div className="cot-detail-body">
            <div>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">Code</span>
              <pre className="font-mono text-[11px] leading-[1.4] text-body whitespace-pre-wrap break-all m-0 mt-0.5 max-h-[140px] overflow-y-auto">
                {step.args?.code ? rawText(step.args.code, 800) : "—"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
