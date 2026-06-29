import { useCallback } from "react";
import { AgentSidebar, type AgentSidebarAdapter, type AgentRunParams, type AgentToolHookPayload } from "src/common/components/agent-sidebar";
import { FetchWebTool, BrowserQuickRunTool } from "src/common/components/agent-sidebar/tools";
import { API_BASE } from "src/lib/client";
import { McpWriteCodeTool } from "./tools/McpWriteCodeTool";
import { McpRunTestTool } from "./tools/McpRunTestTool";

// ── Props ─────────────────────────────────────────────────────────────────────

interface McpAiCodingPanelProps {
  serverId: string;
  toolId: string;
  toolName: string;
  toolDescription: string;
  inputSchema: string;
  currentCode: string;
  onApplyCode: (code: string) => void;
}

// ── Adapter (UI only) ─────────────────────────────────────────────────────────

const ADAPTER: AgentSidebarAdapter = {
  toolComponents: {
    write_code: McpWriteCodeTool,
    run_test: McpRunTestTool,
    fetch_web: FetchWebTool,
    browser_quick_run: BrowserQuickRunTool,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function McpAiCodingPanel({ serverId, toolId, toolName, toolDescription, inputSchema, currentCode, onApplyCode }: McpAiCodingPanelProps) {
  const handleRun = useCallback(
    async (params: AgentRunParams) => {
      const token = localStorage.getItem("access_token");
      return fetch(`${API_BASE || ""}/api/mcp-tool-servers/coding-agent`, {
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
          serverId,
          toolId,
          toolName,
          toolDescription,
          inputSchema,
        }),
        signal: params.signal,
      });
    },
    [serverId, toolId, toolName, toolDescription, inputSchema],
  );

  const handleHooks = useCallback(
    (payload: AgentToolHookPayload) => {
      if (payload.toolName === "write_code" && payload.phase === "code" && payload.code) {
        onApplyCode(payload.code);
      }
    },
    [onApplyCode],
  );

  return <AgentSidebar adapter={ADAPTER} currentCode={currentCode} onRun={handleRun} onHooks={handleHooks} />;
}
