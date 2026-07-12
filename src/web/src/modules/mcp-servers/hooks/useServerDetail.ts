import { App } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import type { McpToolItem, McpToolServerItem } from "src/lib/types";

export function useServerDetail() {
  const { message, modal } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<McpToolServerItem | null>(null);
  const [tools, setTools] = useState<McpToolItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** Raw API key — shown only once after create/regenerate */
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null);

  const isBuiltin = server?.type === "builtin";

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [srv, toolsRes] = await Promise.all([client.mcpToolServers.get(id), client.mcpToolServers.listTools(id)]);
      setServer(srv);
      setTools(toolsRes.items);
    } catch {
      message.error("Failed to load MCP server");
      navigate("/mcp-servers");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Toggle tool active/inactive ──────────────────────────────────────────

  const handleToggleTool = async (tool: McpToolItem) => {
    if (!id) return;
    try {
      const updated = await client.mcpToolServers.updateTool(id, tool.id, {
        isActive: !tool.isActive,
      });
      setTools((prev) => prev.map((t) => (t.id === tool.id ? updated : t)));
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
    }
  };

  // ── Create tool (name only) then navigate to editor ─────────────────────

  const handleCreateTool = async (name: string) => {
    if (!id) return;
    try {
      const tool = await client.mcpToolServers.createTool(id, {
        name,
        description: "",
        code: "",
      });
      message.success(`Tool "${tool.name}" created`);
      navigate(`/mcp-servers/${id}/tools/${tool.id}`);
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
      else message.error("Failed to create tool");
    }
  };

  // ── Edit server ──────────────────────────────────────────────────────────

  const handleEditServer = async (data: { name?: string; description?: string; extendsBuiltin?: string[] }) => {
    if (!id) return;
    try {
      const updated = await client.mcpToolServers.update(id, data);
      setServer(updated);
      message.success("Server updated");
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
    }
  };

  // ── Toggle system tool inheritance ───────────────────────────────────────

  const handleToggleSystemTool = async (toolName: string, active: boolean) => {
    if (!id || !server) return;
    try {
      let newExtended = [...(server.extendsBuiltin || [])];
      if (active) {
        if (!newExtended.includes(toolName)) newExtended.push(toolName);
      } else {
        newExtended = newExtended.filter((name) => name !== toolName);
      }
      const updated = await client.mcpToolServers.update(id, {
        extendsBuiltin: newExtended,
      });
      setServer(updated);
      message.success(`${active ? "Enabled" : "Disabled"} inheritance for ${toolName}`);
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
    }
  };

  // ── Delete server ────────────────────────────────────────────────────────

  const handleDeleteServer = () => {
    if (!id || isBuiltin) return;
    modal.confirm({
      title: "Delete MCP Server",
      content: `Deleting "${server?.name}" will delete all ${tools.length} tool(s) belonging to this server. This action cannot be undone.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await client.mcpToolServers.delete(id);
          message.success("Server deleted");
          navigate("/mcp-servers");
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  // ── Delete tool ──────────────────────────────────────────────────────────

  const handleDeleteTool = (tool: McpToolItem) => {
    if (!id) return;
    modal.confirm({
      title: "Delete Tool",
      content: `Delete tool "${tool.name}"? This action cannot be undone.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await client.mcpToolServers.deleteTool(id, tool.id);
          setTools((prev) => prev.filter((t) => t.id !== tool.id));
          message.success(`Tool "${tool.name}" deleted`);
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  // ── Regenerate API key ───────────────────────────────────────────────────

  const handleRegenerateKey = () => {
    if (!id) return;

    const doRegenerate = async () => {
      try {
        const result = await client.mcpToolServers.regenerateKey(id);
        setRevealedApiKey(result.apiKey);
        setServer((prev) => (prev ? { ...prev, hasApiKey: result.hasApiKey } : prev));
        message.success("API key regenerated — copy it now");
      } catch (err) {
        if (err instanceof GomuStackError) message.error(err.message);
        else message.error("Failed to regenerate API key");
      }
    };

    if (server?.hasApiKey) {
      modal.confirm({
        title: "Regenerate API Key",
        content: "This will invalidate the current key. Agents using the old key will disconnect until you update them.",
        okText: "Regenerate",
        cancelText: "Cancel",
        onOk: doRegenerate,
      });
      return;
    }

    void doRegenerate();
  };

  // ── Revoke API key ──────────────────────────────────────────────────────

  const handleRevokeKey = () => {
    if (!id) return;
    modal.confirm({
      title: "Revoke API Key",
      content: "Revoking the API key will disconnect all agents using it. You can regenerate a new key later.",
      okText: "Revoke",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await client.mcpToolServers.revokeKey(id);
          setServer((prev) => (prev ? { ...prev, hasApiKey: false } : prev));
          setRevealedApiKey(null);
          message.success("API key revoked");
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  return {
    id,
    server,
    tools,
    loading,
    isBuiltin,
    revealedApiKey,
    handleToggleTool,
    handleCreateTool,
    handleEditServer,
    handleToggleSystemTool,
    handleDeleteServer,
    handleDeleteTool,
    handleRegenerateKey,
    handleRevokeKey,
    navigate,
  };
}

