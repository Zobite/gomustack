import { Copy, Globe, Key, RefreshCw, Trash2 } from "lucide-react";
import { App } from "antd";

// ── Config Tab ────────────────────────────────────────────────────────────────

export function ConfigTab({
  mcpEndpoint,
  serverName,
  hasApiKey,
  revealedApiKey,
  canManageKey,
  onRegenerateKey,
  onRevokeKey,
}: {
  mcpEndpoint: string;
  serverName: string;
  hasApiKey: boolean;
  revealedApiKey: string | null;
  canManageKey: boolean;
  onRegenerateKey: () => void;
  onRevokeKey: () => void;
}) {
  const { message } = App.useApp();

  const authValue = revealedApiKey || (hasApiKey ? "•".repeat(40) : "<NO_KEY>");
  const hasKey = hasApiKey || !!revealedApiKey;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success("Copied to clipboard");
  };

  const claudeCodeCmd = revealedApiKey
    ? `claude mcp add --transport http ${serverName} ${mcpEndpoint} --header "Authorization: Bearer ${revealedApiKey}"`
    : `claude mcp add --transport http ${serverName} ${mcpEndpoint} --header "Authorization: Bearer <YOUR_MCP_KEY>"`;

  const antigravityConfig = JSON.stringify(
    {
      mcpServers: {
        [serverName]: {
          serverUrl: `${mcpEndpoint}`,
          headers: {
            Authorization: `Bearer ${revealedApiKey || "<YOUR_MCP_KEY>"}`,
          },
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="flex flex-col gap-8 max-w-[800px] mx-auto">
      {/* Endpoint Info */}
      <div className="animate-[fadeInUp_0.35s_cubic-bezier(0.16,1,0.3,1)_both]">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={14} className="text-muted" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">MCP Endpoint</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 rounded-md border border-hairline bg-surface-card">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#1f8a65] bg-[#1f8a65]/10 px-2 py-0.5 rounded shrink-0">POST</span>
          <code className="font-mono text-[13px] text-ink flex-1 break-all">{mcpEndpoint}</code>
        </div>
        <p className="text-[12px] text-muted mt-2 mb-0">Streamable HTTP transport — compatible with MCP SDK 2025+</p>
      </div>

      {/* MCP Server API Key */}
      <div className="animate-[fadeInUp_0.35s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: "0.05s" }}>
        <div className="flex items-center gap-2 mb-4">
          <Key size={14} className="text-muted" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Server API Key</span>
        </div>
        <div className="px-4 py-4 rounded-md border border-hairline bg-surface-card flex flex-col gap-3">
          <div>
            <div className="text-[13px] text-ink font-medium">MCP Server Key</div>
            <div className="text-[12px] text-muted mt-0.5">
              This key is scoped to this MCP server only. It cannot access other APIs.
            </div>
          </div>

          {hasKey ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-md bg-[#1e1e1e] border border-hairline font-mono text-[12px] text-[#d4d4d4] break-all select-all">
                {authValue}
              </div>
              {revealedApiKey && (
                <button
                  onClick={() => copyToClipboard(revealedApiKey)}
                  className="flex items-center justify-center w-8 h-8 rounded-md bg-transparent border border-hairline text-muted hover:text-ink hover:border-hairline-strong cursor-pointer transition-colors shrink-0"
                  title="Copy key"
                >
                  <Copy size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="px-3 py-2 rounded-md bg-[#1e1e1e]/50 border border-hairline border-dashed font-mono text-[12px] text-muted-soft text-center">
              {canManageKey ? "No API key — click Generate Key to create one" : "No API key"}
            </div>
          )}

          {revealedApiKey ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#1f8a65]/5 border border-[#1f8a65]/20">
              <span className="text-[11px] text-[#1f8a65] font-medium">Copy this key now — it won't be shown again.</span>
            </div>
          ) : hasKey ? (
            <div className="text-[12px] text-muted">
              Full key is only shown once after generate. Regenerate to get a new copyable key (old key stops working).
            </div>
          ) : null}

          {canManageKey && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onRegenerateKey}
                className="flex items-center gap-1.5 h-[30px] px-3 rounded-md bg-transparent border border-hairline text-muted font-mono text-[11px] uppercase tracking-wider hover:border-hairline-strong hover:text-ink cursor-pointer transition-colors"
              >
                <RefreshCw size={12} />
                {hasKey ? "Regenerate" : "Generate Key"}
              </button>
              {hasKey && (
                <button
                  onClick={onRevokeKey}
                  className="flex items-center gap-1.5 h-[30px] px-3 rounded-md bg-transparent border border-[#cf2d56]/20 text-[#cf2d56] font-mono text-[11px] uppercase tracking-wider hover:bg-[#cf2d56]/5 hover:border-[#cf2d56]/40 cursor-pointer transition-colors"
                >
                  <Trash2 size={12} />
                  Revoke
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Claude Code */}
      <ConfigBlock title="Claude Code" subtitle="Run this command in your terminal" code={claudeCodeCmd} delay="0.15s" />

      {/* Antigravity (Gemini) */}
      <ConfigBlock
        title="Antigravity / Gemini"
        subtitle="Add to mcp_config.json — authenticates via Authorization: Bearer <MCP_SERVER_KEY>"
        code={antigravityConfig}
        delay="0.2s"
      />
    </div>
  );
}

// ── Reusable Config Block ─────────────────────────────────────────────────────

function ConfigBlock({
  title,
  subtitle,
  code,
  delay = "0s",
}: {
  title: string;
  subtitle: string;
  code: string;
  delay?: string;
}) {
  return (
    <div className="animate-[fadeInUp_0.35s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: delay }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-mono text-[12px] text-ink font-medium">{title}</div>
          <div className="text-[11px] text-muted-soft mt-0.5">{subtitle}</div>
        </div>
      </div>
      <pre className="m-0 p-4 rounded-md bg-[#1e1e1e] border border-hairline font-mono text-[12px] text-[#d4d4d4] overflow-x-auto leading-relaxed whitespace-pre">
        {code}
      </pre>
    </div>
  );
}
