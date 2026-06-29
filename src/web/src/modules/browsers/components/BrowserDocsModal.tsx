import { Modal, message } from "antd";
import { BookOpen, Check, Copy } from "lucide-react";
import { useState } from "react";
import ApiKeyInput from "src/common/components/ApiKeyInput";
import { useApiKey } from "src/common/hooks/useApiKey";
import { API_BASE } from "src/lib/client";
import type { BrowserProfileItem } from "src/lib/resources/browser";
import { getFingerprintSummary, getProxyDisplay } from "../common/utils";

interface BrowserDocsModalProps {
  open: boolean;
  onClose: () => void;
  profiles: BrowserProfileItem[];
}

export default function BrowserDocsModal({ open, onClose, profiles }: BrowserDocsModalProps) {
  const [copied, setCopied] = useState(false);
  const [apiKey] = useApiKey();

  const apiHost = API_BASE ? API_BASE : window.location.origin;
  const displayKey = apiKey.trim() || "YOUR_API_KEY";

  // Build the context schema string for the prompt
  const profileDescription =
    profiles.length > 0
      ? profiles
          .map((p) => {
            const proxy = getProxyDisplay(p.proxyConfig);
            const fp = getFingerprintSummary(p.fingerprintConfig);
            const tabs = p.status === "running" && p.tabCount > 0 ? `, Open Tabs: ${p.tabCount}` : "";
            return `  - **${p.name}** (ID: \`${p.id}\`, Status: \`${p.status}\`${tabs}, Proxy: ${proxy}, Fingerprint: ${fp})`;
          })
          .join("\n")
      : "  - (No browser profiles created yet)";

  const llmPrompt = `This document provides connection details and API reference to programmatically interact with the Browser Profiles module of GomuStack.

### Connection & Authentication
- **System**: GomuStack
- **API Base URL**: ${apiHost}/api
- **Authentication**: You must authenticate every HTTP request by including this header:
  - \`X-API-Key: ${displayKey}\`

### Current Workspace Context
- **Available Browser Profiles**:
${profileDescription}

### REST API Endpoints (Browser Profiles)

1. **List All Profiles**
   - **Method**: \`GET\`
   - **Path**: \`/browsers?page=1&limit=10&search=keyword\`
   - **Response**: \`{ items: [...], meta: { total, page, limit, hasMore } }\`

2. **Get a Single Profile**
   - **Method**: \`GET\`
   - **Path**: \`/browsers/:profileId\`
   - **Response**: Full profile object with \`id\`, \`name\`, \`status\`, \`proxyConfig\`, \`fingerprintConfig\`, etc.

3. **Create a New Profile**
   - **Method**: \`POST\`
   - **Path**: \`/browsers\`
   - **Body (JSON)**:
     \`\`\`json
     {
       "name": "My Browser",
       "description": "Optional description",
       "proxyConfig": { "server": "http://proxy:8080", "username": "user", "password": "pass" },
       "fingerprintConfig": { "viewport": { "width": 1920, "height": 1080 }, "locale": "en-US" }
     }
     \`\`\`
   - **Notes**: \`proxyConfig\` and \`fingerprintConfig\` are optional. A realistic fingerprint is auto-generated if omitted.

4. **Update a Profile** (must be idle)
   - **Method**: \`PATCH\`
   - **Path**: \`/browsers/:profileId\`
   - **Body (JSON)**: Same fields as create (all optional).

5. **Delete a Profile**
   - **Method**: \`DELETE\`
   - **Path**: \`/browsers/:profileId\`
   - **Response**: \`{ id, deleted: true }\`

---

### Browser Lifecycle

6. **Start a Browser** (launch headless Chromium with profile data)
   - **Method**: \`POST\`
   - **Path**: \`/browsers/:profileId/start\`
   - **Response**: \`{ id, status: "running", cdpPort, wsEndpoint }\`
   - **Notes**: Returns a CDP WebSocket endpoint for direct Puppeteer/Playwright connection. Max concurrent browsers is limited (default 3).

7. **Stop a Browser**
   - **Method**: \`POST\`
   - **Path**: \`/browsers/:profileId/stop\`
   - **Response**: \`{ id, stopped: true }\`

8. **Get Open Tabs**
   - **Method**: \`GET\`
   - **Path**: \`/browsers/:profileId/tabs\`
   - **Response**: \`[{ index, url, title }]\`

9. **Take Screenshot**
   - **Method**: \`GET\`
   - **Path**: \`/browsers/:profileId/screenshot?tabIndex=0\`
   - **Response**: PNG image binary.

---

### Remote Control (Execute Steps)

10. **Run Browser Actions** (chained steps in sequence)
    - **Method**: \`POST\`
    - **Path**: \`/browsers/:profileId/control\`
    - **Body (JSON)**:
      \`\`\`json
      {
        "tabIndex": 0,
        "steps": [
          { "action": "navigate", "url": "https://example.com" },
          { "action": "click", "selector": "#login-btn" },
          { "action": "type", "selector": "#email", "text": "user@example.com" },
          { "action": "screenshot" }
        ]
      }
      \`\`\`
    - **Supported actions**: \`navigate\`, \`click\`, \`type\`, \`screenshot\`, \`get_content\`, \`eval\`, \`wait\`
    - **Tab behavior**:
      - **Omit \`tabIndex\`**: A new tab is created, steps run inside it, then the tab is auto-closed. Best for one-off automation.
      - **Pass \`tabIndex\`**: Reuses the existing tab at that index. The tab stays open after execution. Best for multi-turn interaction.
    - **Notes**: Set \`timeout\` per step (ms) to override the default 10s. Execution stops on the first error.
    - **Response**: \`{ profileId, persistent: true, tabIndex: <used>, results: [{ step, action, success, result/error }] }\`
`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(llmPrompt);
      setCopied(true);
      message.success("LLM Prompt copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      message.error("Failed to copy prompt");
    }
  };

  return (
    <Modal
      title={
        <div className="flex flex-col gap-0.5 pt-1">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted font-medium">
            <BookOpen size={12} />
            <span>System Reference</span>
          </div>
          <div className="font-display text-[20px] md:text-[24px] tracking-tight text-ink font-normal leading-tight">Connect LLM to Browsers</div>
        </div>
      }
      open={open}
      onCancel={onClose}
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
              <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium">llm-browser-instructions.md</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border border-hairline rounded bg-surface-card hover:bg-canvas transition-colors cursor-pointer text-ink"
            >
              {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
              {copied ? "Copy Prompt" : "Copy Prompt"}
            </button>
          </div>
          <pre className="m-0 p-4 bg-surface-card text-ink font-mono text-[12px] overflow-auto max-h-[380px] leading-relaxed whitespace-pre-wrap select-text selection:bg-surface-strong">
            {llmPrompt}
          </pre>
        </div>

        <div className="flex justify-end mt-2 pt-4 border-t border-hairline">
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-ink text-canvas rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-all border-none"
          >
            Dismiss
          </button>
        </div>
      </div>
    </Modal>
  );
}
