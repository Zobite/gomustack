import { Form, Input, Modal, Spin } from "antd";
import { ArrowLeft, Edit3, Plug, Shield, Terminal, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { API_BASE } from "src/lib/client";
import { ConfigTab } from "../components/ConfigTab";
import { ToolsTab } from "../components/ToolsTab";
import { useServerDetail } from "../hooks/useServerDetail";

// ══════════════════════════════════════════════════════════════════════════════
//  MCP SERVER DETAIL PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function McpServerDetailPage() {
  const { id, server, tools, loading, isBuiltin, revealedApiKey, handleToggleTool, handleCreateTool, handleEditServer, handleToggleSystemTool, handleDeleteServer, handleDeleteTool, handleRegenerateKey, handleRevokeKey, navigate } =
    useServerDetail();

  const [activeTab, setActiveTab] = useState<"tools" | "config">("tools");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [form] = Form.useForm();

  // ── New Tool modal state ────────────────────────────────────────────────
  const [newToolOpen, setNewToolOpen] = useState(false);
  const [newToolLoading, setNewToolLoading] = useState(false);
  const [newToolForm] = Form.useForm();

  const handleEditSubmit = async () => {
    try {
      const values = await form.validateFields();
      setEditLoading(true);
      await handleEditServer({
        name: values.name,
        description: values.description || "",
      });
      setEditDialogOpen(false);
    } catch {
      // Form validation failed or edit failed
    } finally {
      setEditLoading(false);
    }
  };

  const apiOrigin = API_BASE || window.location.origin;
  const mcpEndpoint = `${apiOrigin}/api/mcp/${id}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-canvas">
        <Spin size="large" />
      </div>
    );
  }

  if (!server) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      {/* Header */}
      <div className="px-4 md:px-8 pt-10 pb-6 shrink-0 border-b border-hairline">
        <button
          onClick={() => navigate("/mcp-servers")}
          className="flex items-center gap-1.5 text-muted text-[13px] mb-4 bg-transparent border-none cursor-pointer hover:text-ink transition-colors p-0"
        >
          <ArrowLeft size={14} />
          <span className="font-mono text-[11px] uppercase tracking-wide">MCP Servers</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md border border-hairline-soft bg-canvas text-muted shrink-0">
              {isBuiltin ? <Shield size={18} strokeWidth={1.5} /> : <Plug size={18} strokeWidth={1.5} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-[28px] font-normal text-ink tracking-[-0.56px] m-0 leading-tight">{server.name}</h1>
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isBuiltin ? "bg-timeline-thinking/30 text-accent-amber" : "bg-ink/10 text-ink"
                  }`}
                >
                  {isBuiltin ? "Built-in" : "Custom"}
                </span>
              </div>
              {server.description && <p className="text-[13px] text-muted mt-1 m-0">{server.description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isBuiltin && (
              <div className="flex items-center gap-2 border-r border-hairline pr-3 mr-1">
                <button
                  onClick={() => {
                    form.setFieldsValue({
                      name: server.name,
                      description: server.description,
                    });
                    setEditDialogOpen(true);
                  }}
                  className="flex items-center gap-1.5 h-[32px] px-3 rounded-md bg-transparent border border-hairline text-muted font-mono text-[11px] uppercase tracking-wider hover:border-hairline-strong hover:text-ink cursor-pointer transition-colors"
                >
                  <Edit3 size={12} />
                  Edit
                </button>
                <button
                  onClick={handleDeleteServer}
                  className="flex items-center gap-1.5 h-[32px] px-3 rounded-md bg-transparent border border-[#cf2d56]/20 text-[#cf2d56] font-mono text-[11px] uppercase tracking-wider hover:bg-[#cf2d56]/5 hover:border-[#cf2d56]/40 cursor-pointer transition-colors"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            )}
            <div className="flex items-center gap-1 p-0.5 rounded-md bg-surface-strong border border-hairline">
              <button
                onClick={() => setActiveTab("tools")}
                className={`flex items-center gap-1.5 h-[30px] px-3 rounded-md font-mono text-[11px] uppercase tracking-wider border-none cursor-pointer transition-all duration-150 ${
                  activeTab === "tools" ? "bg-canvas text-ink" : "bg-transparent text-muted hover:text-ink"
                }`}
              >
                <Wrench size={12} />
                Tools
              </button>
              <button
                onClick={() => setActiveTab("config")}
                className={`flex items-center gap-1.5 h-[30px] px-3 rounded-md font-mono text-[11px] uppercase tracking-wider border-none cursor-pointer transition-all duration-150 ${
                  activeTab === "config" ? "bg-canvas text-ink" : "bg-transparent text-muted hover:text-ink"
                }`}
              >
                <Terminal size={12} />
                Connect
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8">
        {activeTab === "tools" ? (
          <ToolsTab
            id={id!}
            isBuiltin={isBuiltin}
            server={server}
            tools={tools}
            onToggle={handleToggleTool}
            onDeleteTool={handleDeleteTool}
            onNewTool={() => setNewToolOpen(true)}
            onToggleSystemTool={handleToggleSystemTool}
            navigate={navigate}
          />
        ) : (
          <ConfigTab
            mcpEndpoint={mcpEndpoint}
            serverName={server.name}
            apiKeyPrefix={server.apiKeyPrefix}
            revealedApiKey={revealedApiKey}
            onRegenerateKey={handleRegenerateKey}
            onRevokeKey={handleRevokeKey}
          />
        )}
      </div>

      {/* Edit Server Dialog */}
      <Modal
        title="Edit MCP Server"
        open={editDialogOpen}
        onOk={handleEditSubmit}
        onCancel={() => {
          form.resetFields();
          setEditDialogOpen(false);
        }}
        okText="Save"
        confirmLoading={editLoading}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false} className="mt-4">
          <Form.Item
            name="name"
            label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Server Name</span>}
            rules={[
              { required: true, message: "Server name is required" },
              {
                pattern: /^[a-zA-Z0-9_-]+$/,
                message: "Only alphanumeric, hyphens, underscores",
              },
              { max: 100, message: "Max 100 characters" },
            ]}
          >
            <Input placeholder="e.g. my-tools" className="font-mono" />
          </Form.Item>
          <Form.Item
            name="description"
            label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Description (optional)</span>}
            rules={[{ max: 1000, message: "Max 1000 characters" }]}
          >
            <Input.TextArea rows={3} placeholder="What tools will this server contain?" showCount maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>

      {/* New Tool Dialog */}
      <Modal
        title="New Tool"
        open={newToolOpen}
        onOk={async () => {
          try {
            const values = await newToolForm.validateFields();
            setNewToolLoading(true);
            await handleCreateTool(values.name);
            setNewToolOpen(false);
            newToolForm.resetFields();
          } catch {
            // validation or API error
          } finally {
            setNewToolLoading(false);
          }
        }}
        onCancel={() => {
          newToolForm.resetFields();
          setNewToolOpen(false);
        }}
        okText="Create"
        confirmLoading={newToolLoading}
        destroyOnHidden
      >
        <Form form={newToolForm} layout="vertical" requiredMark={false} className="mt-4">
          <Form.Item
            name="name"
            label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Tool Name</span>}
            rules={[
              { required: true, message: "Tool name is required" },
              {
                pattern: /^[a-z0-9_]+$/,
                message: "Must be snake_case (lowercase alphanumeric + underscore)",
              },
              { max: 100, message: "Max 100 characters" },
            ]}
          >
            <Input placeholder="e.g. get_weather" className="font-mono" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
