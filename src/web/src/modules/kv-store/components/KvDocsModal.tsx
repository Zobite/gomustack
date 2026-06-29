import { Modal, message } from "antd";
import { BookOpen, Check, Copy } from "lucide-react";
import { useState } from "react";
import ApiKeyInput from "src/common/components/ApiKeyInput";
import { useApiKey } from "src/common/hooks/useApiKey";
import { API_BASE } from "src/lib/client";

// ══════════════════════════════════════════════════════════════════════════════
//  KV STORE — DOCS & PROMPT MODAL (self-contained with trigger button)
// ══════════════════════════════════════════════════════════════════════════════

export default function KvDocsModal() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [apiKey] = useApiKey();

  const apiHost = API_BASE ? API_BASE : window.location.origin;
  const displayKey = apiKey.trim() || "YOUR_API_KEY";

  const llmPrompt = `This document provides connection details and API reference to programmatically interact with the KV Store module.

### Connection & Authentication
- **System**: GomuStack
- **API Base URL**: ${apiHost}/api
- **Authentication**: You must authenticate every HTTP request by including this header:
  - \`X-API-Key: ${displayKey}\`

### REST API Endpoints (Key-Centric)

1. **Create or Update (Upsert) by Key**
   - **Method**: \`POST\`
   - **Path**: \`/kv-store\`
   - **Body (JSON)**:
     \`\`\`json
     {
       "key": "config.api_url", // Key is globally unique. If the key already exists, it automatically updates its value.
       "value": "https://api.example.com",
       "type": "string", // optional, values: "string" | "number" | "boolean" | "json"
       "ttl": 3600 // optional, time-to-live in seconds (omit or 0 for no expiration)
     }
     \`\`\`
   - **Response**: \`{ id, key, value, type, expiresAt }\`

2. **Retrieve Variable by Key**
   - **Method**: \`GET\`
   - **Path**: \`/kv-store/by-key/:key\`
   - **Response**: \`{ id, key, value, type, expiresAt }\`

3. **Delete Variable by Key**
   - **Method**: \`DELETE\`
   - **Path**: \`/kv-store/by-key/:key\`
   - **Response**: \`{ key, deleted: true }\`

4. **List & Search Keys** (paginated, searchable)
   - **Method**: \`GET\`
   - **Path**: \`/kv-store\`
   - **Query Params**:
     - \`search\` (optional string): Filter by key prefix or name
     - \`page\` (optional number, default: 1)
     - \`limit\` (optional number, default: 50)
   - **Response**: \`{ items: [{ id, key, value, type, expiresAt }], meta: { total, page, limit } }\`
`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(llmPrompt);
      setCopied(true);
      message.success("LLM Prompt copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error("Failed to copy prompt");
    }
  };

  return (
    <>
      {/* ── Trigger Button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-[36px] px-4 rounded-md bg-transparent border border-hairline font-medium text-[13px] cursor-pointer transition-colors hover:bg-canvas hover:border-ink text-ink"
      >
        <BookOpen size={14} className="text-muted" />
        API & Prompt
      </button>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      <Modal
        title={
          <div className="flex flex-col gap-0.5 pt-1">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted font-medium">
              <BookOpen size={12} />
              <span>System Reference</span>
            </div>
            <div className="font-display text-[20px] md:text-[24px] tracking-tight text-ink font-normal leading-tight">Connect LLM to KV Store</div>
          </div>
        }
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
        centered
        closable={true}
      >
        <div className="mt-4 flex flex-col gap-5 text-ink">
          <ApiKeyInput />

          {/* Prompt View */}
          <div className="flex flex-col border border-hairline rounded-lg overflow-hidden bg-canvas-soft">
            <div className="flex justify-between items-center bg-canvas-soft px-4 py-2.5 border-b border-hairline shrink-0">
              {/* Simulated IDE tab indicators */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full border border-hairline-strong" />
                  <div className="w-2.5 h-2.5 rounded-full border border-hairline-strong" />
                  <div className="w-2.5 h-2.5 rounded-full border border-hairline-strong" />
                </div>
                <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium">llm-kv-instructions.md</span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border border-hairline rounded bg-surface-card hover:bg-canvas transition-colors cursor-pointer text-ink"
              >
                {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy Prompt"}
              </button>
            </div>
            <pre className="m-0 p-4 bg-surface-card text-ink font-mono text-[12px] overflow-auto max-h-[380px] leading-relaxed whitespace-pre-wrap select-text selection:bg-surface-strong">
              {llmPrompt}
            </pre>
          </div>

          <div className="flex justify-end mt-2 pt-4 border-t border-hairline">
            <button
              onClick={() => setOpen(false)}
              className="px-5 py-1.5 bg-ink text-canvas rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-all border-none"
            >
              Dismiss
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
