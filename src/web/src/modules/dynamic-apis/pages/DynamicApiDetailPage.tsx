import { Modal, Spin, Tabs, message } from "antd";
import { AlertTriangle, Bot, Clock, PanelRightClose, PanelRightOpen, Play, Terminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { API_BASE, client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import type { DynamicApiItem, DynamicApiLogItem } from "src/lib/types";

import { useNavigate, useParams } from "react-router-dom";
import { AiCodingPanel } from "../components/AiCodingPanel";
import { EndpointHeader } from "../components/EndpointHeader";
import { HandlerCodeEditor } from "../components/HandlerCodeEditor";
import { LogsPanel } from "../components/LogsPanel";
import { TestPanel } from "../components/TestPanel";

const { confirm } = Modal;

const DEFAULT_CODE = `async function handler(request, context) {
  // request: { method, path, params, query, headers, body }
  // context: { log }
  //
  // Return: { status, headers?, body }

  context.log("Hello from handler!");

  return {
    status: 200,
    body: { message: "Hello World" }
  };
}`;

// ══════════════════════════════════════════════════════════════════════════════
//  DYNAMIC API DETAIL PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function DynamicApiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [api, setApi] = useState<DynamicApiItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [method, setMethod] = useState<DynamicApiItem["method"]>("GET");
  const [path, setPath] = useState("");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isActive, setIsActive] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [timeout, setTimeoutVal] = useState(30000);

  // Test panel state
  const [testBody, setTestBody] = useState("{}");
  const [testResult, setTestResult] = useState<{
    status: number;
    body: unknown;
    consoleLogs?: string[];
    executionTimeMs?: number;
    error?: string;
    time?: number;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  // Logs
  const [logs, setLogs] = useState<DynamicApiLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // AI panel visibility + resizable width
  const [showAiPanel, setShowAiPanel] = useState(true);
  const AI_PANEL_MIN = 280;
  const AI_PANEL_MAX = 700;
  const AI_PANEL_DEFAULT = 420;
  const [aiPanelWidth, setAiPanelWidth] = useState(() => {
    const saved = localStorage.getItem("ai_panel_width");
    const w = saved ? Number(saved) : AI_PANEL_DEFAULT;
    return Math.max(AI_PANEL_MIN, Math.min(AI_PANEL_MAX, w));
  });
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  // AI pending code (for diff review)
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  // Dirty tracking — track fields that require manual Save
  // (isActive and isPublic auto-save immediately, so excluded here)
  const savedCodeRef = useRef(DEFAULT_CODE);
  const savedMetaRef = useRef({ name: "", method: "GET" as DynamicApiItem["method"], path: "", timeout: 30000 });
  const isDirty =
    code !== savedCodeRef.current ||
    name !== savedMetaRef.current.name ||
    method !== savedMetaRef.current.method ||
    path !== savedMetaRef.current.path ||
    timeout !== savedMetaRef.current.timeout;

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const fetchApi = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await client.dynamicApis.get(id);
      setApi(data);
      setName(data.name);
      setMethod(data.method);
      setPath(data.path);
      setCode(data.code || DEFAULT_CODE);
      savedCodeRef.current = data.code || DEFAULT_CODE;
      setIsActive(data.isActive);
      setIsPublic(data.isPublic);
      setTimeoutVal(data.timeout);
      savedMetaRef.current = { name: data.name, method: data.method, path: data.path, timeout: data.timeout };

      // If there's a pending draft from AI, show it as a diff
      if (data.draftCode && data.draftCode !== data.code) {
        setPendingCode(data.draftCode);
      }
    } catch {
      message.error("Failed to load API");
      navigate("/dynamic-apis");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchApi();
  }, [fetchApi]);

  const fetchLogs = useCallback(async () => {
    if (!id) return;
    setLogsLoading(true);
    try {
      const result = await client.dynamicApis.listLogs(id, { limit: 50 });
      setLogs(result.items);
    } catch {
      // silent
    } finally {
      setLogsLoading(false);
    }
  }, [id]);

  // ── Keyboard Shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSave = async (codeOverride?: string) => {
    if (!id || saving) return;
    const codeToSave = codeOverride ?? code;
    setSaving(true);
    try {
      const updated = await client.dynamicApis.update(id, {
        name,
        method,
        path,
        description: null,
        code: codeToSave,
        draftCode: codeToSave, // Keep draft in sync with prod
        isActive,
        isPublic,
        timeout,
      });
      setApi(updated);
      savedCodeRef.current = codeToSave;
      savedMetaRef.current = { name, method, path, timeout };
      message.success("Saved");
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
      else message.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!api) return;
    confirm({
      title: <span className="font-mono text-[14px]">Delete Endpoint</span>,
      icon: <AlertTriangle size={20} className="text-error mr-2" />,
      content: `Delete "${api.name}" (${api.method} ${api.path})? This action is irreversible.`,
      okText: "Delete",
      okType: "danger",
      async onOk() {
        try {
          await client.dynamicApis.delete(api.id);
          message.success(`Deleted "${api.name}"`);
          navigate("/dynamic-apis");
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  const handleTest = async (params: Record<string, string>, query: Record<string, string>, headers: Record<string, string>) => {
    if (!api) return;
    setTesting(true);
    setTestResult(null);
    try {
      // Save current editor code as draftCode first (same pattern as MCP tools)
      await client.dynamicApis.update(api.id, { draftCode: code });

      // Dry-run: test the draft code from DB
      const url = `${API_BASE || ""}/api/dynamic-apis/${api.id}/test`;
      const token = localStorage.getItem("access_token");

      let bodyParsed: unknown = null;
      if (["POST", "PUT", "PATCH"].includes(method)) {
        try {
          bodyParsed = JSON.parse(testBody);
        } catch {
          bodyParsed = testBody;
        }
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          source: "draft",
          params,
          query,
          headers,
          body: bodyParsed,
        }),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({
        status: 0,
        body: { error: "network_error", message: (err as Error).message },
      });
    } finally {
      setTesting(false);
    }
  };

  // ── AI code apply handler (same flow as MCP tools) ───────────────────────
  const handleApplyCode = useCallback((newCode: string, isFinal?: boolean) => {
    if (isFinal) {
      setCode(newCode);
      // Defer DiffEditor unmount by 1 frame so Monaco's DiffEditorWidget
      // can dispose its internal models before React removes the DOM element.
      requestAnimationFrame(() => {
        setPendingCode(null);
      });
    } else {
      setPendingCode(newCode);
    }
  }, []);

  // ── Pending code accept/reject (same flow as MCP tools) ──────────────────
  const handleAcceptPending = async () => {
    if (pendingCode) {
      const codeToSave = pendingCode;
      setCode(codeToSave);
      // Defer DiffEditor unmount by 1 frame (same reason as above)
      requestAnimationFrame(() => {
        setPendingCode(null);
      });
      await handleSave(codeToSave);
    }
  };

  const handleRejectPending = async () => {
    // Defer DiffEditor unmount by 1 frame (same reason as above)
    requestAnimationFrame(() => {
      setPendingCode(null);
    });
    // Reset draftCode back to prod code in DB
    if (id) {
      client.dynamicApis.update(id, { draftCode: savedCodeRef.current }).catch(() => {});
    }
  };

  // ── AI panel resize handlers ─────────────────────────────────────────────

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startW: aiPanelWidth };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startX - ev.clientX;
        const next = Math.max(AI_PANEL_MIN, Math.min(AI_PANEL_MAX, dragRef.current.startW + delta));
        setAiPanelWidth(next);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setAiPanelWidth((w) => {
          localStorage.setItem("ai_panel_width", String(w));
          return w;
        });
        dragRef.current = null;
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [aiPanelWidth],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-canvas">
        <Spin size="large" />
      </div>
    );
  }

  if (!api) return null;

  const baseUrl = API_BASE || window.location.origin;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      <EndpointHeader
        baseUrl={baseUrl}
        dirty={isDirty}
        saving={saving}
        isActive={isActive}
        name={name}
        method={method}
        path={path}
        isPublic={isPublic}
        timeout={timeout}
        onBack={() => navigate("/dynamic-apis")}
        onDelete={handleDelete}
        onSave={handleSave}
        onActiveChange={async (checked) => {
          setIsActive(checked);
          if (!id) return;
          try {
            const updated = await client.dynamicApis.update(id, { isActive: checked });
            setApi(updated);
          } catch (err) {
            setIsActive(!checked); // revert on failure
            if (err instanceof GomuStackError) message.error(err.message);
            else message.error("Failed to update");
          }
        }}
        onNameChange={(v) => {
          setName(v);
        }}
        onMethodChange={(v) => {
          setMethod(v);
        }}
        onPathChange={(v) => {
          setPath(v);
        }}
        onPublicChange={async (v) => {
          setIsPublic(v);
          if (!id) return;
          try {
            const updated = await client.dynamicApis.update(id, { isPublic: v });
            setApi(updated);
          } catch (err) {
            setIsPublic(!v); // revert on failure
            if (err instanceof GomuStackError) message.error(err.message);
            else message.error("Failed to update");
          }
        }}
        onTimeoutChange={(v) => {
          setTimeoutVal(v);
        }}
      />

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left/Center: Code + Test + Logs (takes all remaining space) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs
            defaultActiveKey="code"
            style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
            styles={{
              header: { paddingLeft: "20px", paddingRight: "20px", flexShrink: 0 },
            }}
            tabBarExtraContent={{
              right: (
                <button
                  onClick={() => setShowAiPanel(!showAiPanel)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 mr-2 rounded-md font-mono text-[11px] border cursor-pointer transition-colors ${
                    showAiPanel
                      ? "bg-[#8b5cf610] text-[#8b5cf6] border-[#8b5cf630] hover:bg-[#8b5cf620]"
                      : "bg-transparent text-muted-soft border-hairline hover:text-ink hover:border-hairline-strong"
                  }`}
                  title={showAiPanel ? "Hide AI Panel" : "Show AI Panel"}
                >
                  {showAiPanel ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
                  <Bot size={12} />
                  AI
                </button>
              ),
            }}
            items={[
              {
                key: "code",
                label: (
                  <span className="flex items-center gap-1.5 font-mono text-[12px]">
                    <Terminal size={13} /> Code
                  </span>
                ),
                children: (
                  <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 160px)" }}>
                    <HandlerCodeEditor
                      value={code}
                      onChange={setCode}
                      pendingCode={pendingCode}
                      onAcceptPending={handleAcceptPending}
                      onRejectPending={handleRejectPending}
                    />
                  </div>
                ),
              },
              {
                key: "test",
                label: (
                  <span className="flex items-center gap-1.5 font-mono text-[12px]">
                    <Play size={13} /> Test
                  </span>
                ),
                children: (
                  <TestPanel
                    method={method}
                    path={path}
                    testBody={testBody}
                    onTestBodyChange={setTestBody}
                    testing={testing}
                    testResult={testResult}
                    onSend={handleTest}
                    baseUrl={baseUrl}
                  />
                ),
              },
              {
                key: "logs",
                label: (
                  <span className="flex items-center gap-1.5 font-mono text-[12px]">
                    <Clock size={13} /> Logs
                  </span>
                ),
                children: <LogsPanel logs={logs} loading={logsLoading} onRefresh={fetchLogs} />,
              },
            ]}
            onChange={(key) => {
              if (key === "logs") fetchLogs();
            }}
          />
        </div>

        {/* Right: AI Agent Panel (collapsible + resizable) */}
        {showAiPanel && (
          <>
            {/* Resize handle */}
            <div
              onMouseDown={handleResizeStart}
              className="shrink-0 w-[5px] cursor-col-resize group relative flex items-center justify-center hover:bg-hairline-soft transition-colors"
              title="Drag to resize"
            >
              <div className="w-[1px] h-8 bg-hairline-strong rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col shrink-0 overflow-hidden" style={{ width: aiPanelWidth }}>
              <AiCodingPanel apiId={api.id} method={method} path={path} currentCode={code} onApplyCode={handleApplyCode} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
