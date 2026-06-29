import { Spin, message } from "antd";
import { ChevronRight, Plug, Plus, Shield, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "src/lib/client";
import type { McpToolServerItem } from "src/lib/types";
import { CreateServerDialog } from "../components/CreateServerDialog";

// ══════════════════════════════════════════════════════════════════════════════
//  MCP SERVERS LIST PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function McpServersListPage() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<McpToolServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await client.mcpToolServers.list();
      setServers(data);
    } catch {
      message.error("Failed to load MCP servers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const handleNewServer = () => {
    setCreateDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      <div className="px-8 pt-10 pb-6 shrink-0 border-b border-hairline">
        <div className="flex items-center gap-2 mb-3">
          <Plug size={16} className="text-muted" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">MCP Servers</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[32px] font-normal text-ink tracking-[-0.64px] m-0 leading-tight">MCP Servers</h1>
            <p className="text-[13px] text-muted mt-1 m-0">Model Context Protocol servers for AI agents to connect and use tools</p>
          </div>
          <button
            className="flex items-center gap-2 h-[36px] px-4 rounded-md bg-ink text-canvas font-medium text-[13px] hover:bg-opacity-90 transition-opacity cursor-pointer border-none"
            onClick={handleNewServer}
          >
            <Plus size={16} />
            New MCP Server
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[240px] flex-1">
            <Spin size="large" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map((srv, idx) => (
              <div
                key={srv.id}
                className="flex flex-col gap-4 p-5 border border-hairline rounded-md bg-surface-card cursor-pointer transition-colors duration-150 ease-in-out hover:border-hairline-strong group opacity-0 animate-[fadeInUp_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]"
                style={{ animationDelay: `${idx * 0.04}s` }}
                onClick={() => navigate(`/mcp-servers/${srv.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-md border border-hairline-soft bg-canvas text-muted shrink-0">
                      {srv.type === "builtin" ? <Shield size={18} strokeWidth={1.5} /> : <Plug size={18} strokeWidth={1.5} />}
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#dfa88f]/30 text-[#8a5a3a]">
                      {srv.type === "builtin" ? "Built-in" : "Custom"}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-ink tracking-tight whitespace-nowrap overflow-hidden text-ellipsis mb-1">{srv.name}</div>
                  <div className="text-[13px] text-muted overflow-hidden text-ellipsis leading-relaxed min-h-[19px] line-clamp-2">{srv.description || "—"}</div>
                </div>

                <div className="flex items-center justify-between border-t border-hairline-soft pt-4 mt-auto">
                  <div className="flex items-center gap-2">
                    <Wrench size={13} className="text-muted-soft" />
                    <span className="font-mono text-[10px] text-muted-soft tracking-wider uppercase">{srv.toolCount} TOOLS</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-[10px] tracking-wider uppercase ${srv.isActive ? "text-[#1f8a65]" : "text-muted-soft"}`}>
                      {srv.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                    <ChevronRight
                      size={14}
                      className="text-muted-soft shrink-0 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-ink"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* New custom server card */}
            <div
              className="flex flex-col gap-4 p-5 border border-dashed border-hairline rounded-md bg-transparent cursor-pointer transition-colors duration-150 hover:border-hairline-strong opacity-0 animate-[fadeInUp_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]"
              style={{ animationDelay: `${servers.length * 0.04}s` }}
              onClick={handleNewServer}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-md border border-dashed border-hairline-strong text-muted-soft">
                <Plus size={18} strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium text-muted tracking-tight mb-1">Custom MCP Server</div>
                <div className="text-[12px] text-muted-soft leading-relaxed">Create custom MCP server with JavaScript tools</div>
              </div>
              <div className="flex items-center gap-2 border-t border-hairline-soft pt-4 mt-auto">
                <Plug size={13} className="text-muted-soft" />
                <span className="font-mono text-[10px] text-muted-soft tracking-wider uppercase">CREATE NEW SERVER</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateServerDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
    </div>
  );
}
