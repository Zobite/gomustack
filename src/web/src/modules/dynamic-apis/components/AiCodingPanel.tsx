import { useCallback } from "react";
import { AgentSidebar, type AgentSidebarAdapter, type AgentRunParams, type AgentToolHookPayload } from "src/common/components/agent-sidebar";
import { FetchWebTool, BrowserQuickRunTool } from "src/common/components/agent-sidebar/tools";
import { API_BASE } from "src/lib/client";
import { DynamicApiWriteCodeTool } from "./tools/DynamicApiWriteCodeTool";
import { DynamicApiRunTestTool } from "./tools/DynamicApiRunTestTool";

// ── Props ─────────────────────────────────────────────────────────────────────

interface AiCodingPanelProps {
  apiId: string;
  method: string;
  path: string;
  currentCode: string;
  onApplyCode: (code: string, isFinal?: boolean) => void;
}

// ── Adapter (UI only) ─────────────────────────────────────────────────────────

const ADAPTER: AgentSidebarAdapter = {
  toolComponents: {
    write_code: DynamicApiWriteCodeTool,
    run_test: DynamicApiRunTestTool,
    fetch_web: FetchWebTool,
    browser_quick_run: BrowserQuickRunTool,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AiCodingPanel({ apiId, method, path, currentCode, onApplyCode }: AiCodingPanelProps) {
  const handleRun = useCallback(
    async (params: AgentRunParams) => {
      const token = localStorage.getItem("access_token");
      return fetch(`${API_BASE || ""}/api/dynamic-apis/coding-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          providerId: params.providerId,
          model: params.model,
          prompt: params.prompt,
          currentCode: params.currentCode,
          history: params.history,
          apiId,
          method,
          path,
        }),
        signal: params.signal,
      });
    },
    [apiId, method, path],
  );

  const handleHooks = useCallback(
    (payload: AgentToolHookPayload) => {
      if (payload.toolName === "write_code" && payload.phase === "code" && payload.code) {
        onApplyCode(payload.code, payload.isFinal);
      }
    },
    [onApplyCode],
  );

  return <AgentSidebar adapter={ADAPTER} currentCode={currentCode} onRun={handleRun} onHooks={handleHooks} />;
}
