import { Spin } from "antd";
import { ArrowLeft, Save, Sparkles, Terminal, Trash2, Wrench } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { McpAiCodingPanel } from "../components/McpAiCodingPanel";
import { ToolCodeEditor } from "../components/ToolCodeEditor";
import { ToolTestPanel } from "../components/ToolTestPanel";
import { parseToolCode, useToolEditor } from "../hooks/useToolEditor";

// ══════════════════════════════════════════════════════════════════════════════
//  MCP TOOL EDITOR PAGE
// ══════════════════════════════════════════════════════════════════════════════

const MIN_PANEL_W = 320;
const MAX_PANEL_W = 700;
const DEFAULT_PANEL_W = 420;

type RightPanelTab = "ai" | "test";

export default function McpToolEditorPage() {
  const {
    serverId,
    toolId,
    loading,
    saving,
    isDirty,
    code,
    setCode,
    pendingCode,
    setPendingCode,
    handleSave,
    handleDelete,
    handleAcceptPending,
    handleRejectPending,
    navigate,
  } = useToolEditor();

  // Dynamically parse live metadata from editor comments
  const liveMeta = parseToolCode(code);
  const liveName = liveMeta.name === "unnamed_tool" ? "" : liveMeta.name;
  const liveDescription = liveMeta.description || "";
  const liveInputSchema = liveMeta.inputSchema || "{}";

  const handleApplyCode = useCallback(
    (newCode: string, isFinal?: boolean) => {
      if (isFinal) {
        setCode(newCode);
        // Defer DiffEditor unmount by 1 frame so Monaco can cleanup
        requestAnimationFrame(() => {
          setPendingCode(null);
        });
      } else {
        setPendingCode(newCode);
      }
    },
    [setCode, setPendingCode],
  );

  // ── Right panel tab ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<RightPanelTab>("ai");

  // ── Resizable panel ──────────────────────────────────────────────────────
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_W);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(DEFAULT_PANEL_W);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startW.current = panelWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = startX.current - ev.clientX;
        const newW = Math.max(MIN_PANEL_W, Math.min(MAX_PANEL_W, startW.current + delta));
        setPanelWidth(newW);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [panelWidth],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-canvas">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 shrink-0 border-b border-hairline flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/mcp-servers/${serverId}`)}
            className="flex items-center gap-1.5 text-muted text-[13px] bg-transparent border-none cursor-pointer hover:text-ink transition-colors p-0"
          >
            <ArrowLeft size={14} />
            <span className="font-mono text-[11px] uppercase tracking-wide">Back</span>
          </button>
          <div className="w-px h-5 bg-hairline" />
          <div className="flex items-center gap-2">
            <Wrench size={14} className="text-muted" />
            <span className="font-mono text-[14px] text-ink font-medium">Edit Tool: {liveName || "Unnamed"}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 h-[32px] px-3 rounded-md bg-transparent border border-[#cf2d56]/20 text-[#cf2d56] font-medium text-[12px] hover:bg-[#cf2d56]/5 hover:border-[#cf2d56]/40 cursor-pointer transition-colors"
          >
            <Trash2 size={12} />
            Delete Tool
          </button>
          <button
            onClick={() => handleSave()}
            disabled={saving || !isDirty}
            className="flex items-center gap-2 h-[36px] px-4 rounded-md bg-ink text-canvas font-medium text-[13px] hover:bg-primary-active transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Code Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ToolCodeEditor
            value={code}
            onChange={setCode}
            pendingCode={pendingCode}
            onAcceptPending={handleAcceptPending}
            onRejectPending={handleRejectPending}
          />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={onMouseDown}
          className="shrink-0 w-[5px] cursor-col-resize bg-transparent hover:bg-hairline-strong active:bg-hairline-strong transition-colors relative group"
          title="Drag to resize"
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-hairline group-hover:bg-muted-soft transition-colors" />
        </div>

        {/* Right panel: Tabs + Content */}
        <div className="shrink-0 flex flex-col bg-surface-card overflow-hidden" style={{ width: panelWidth }}>
          {/* Tab bar */}
          <div className="shrink-0 flex items-center border-b border-hairline bg-canvas">
            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.6px] font-semibold border-none cursor-pointer transition-colors relative ${
                activeTab === "ai" ? "text-ink bg-transparent" : "text-muted-soft bg-transparent hover:text-muted"
              }`}
            >
              <Sparkles size={13} />
              AI Agent
              {activeTab === "ai" && <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-ink rounded-t-full" />}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("test")}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.6px] font-semibold border-none cursor-pointer transition-colors relative ${
                activeTab === "test" ? "text-ink bg-transparent" : "text-muted-soft bg-transparent hover:text-muted"
              }`}
            >
              <Terminal size={13} />
              Test
              {activeTab === "test" && <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-ink rounded-t-full" />}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "ai" ? (
              <McpAiCodingPanel
                serverId={serverId!}
                toolId={toolId!}
                toolName={liveName}
                toolDescription={liveDescription}
                inputSchema={liveInputSchema}
                currentCode={code}
                onApplyCode={handleApplyCode}
              />
            ) : (
              <ToolTestPanel serverId={serverId!} toolId={toolId} code={code} inputSchema={liveInputSchema} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
