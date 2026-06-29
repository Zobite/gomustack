import { Modal, message } from "antd";
import { BookOpen, Check, Copy } from "lucide-react";
import { useState } from "react";
import ApiKeyInput from "src/common/components/ApiKeyInput";
import { useApiKey } from "src/common/hooks/useApiKey";
import { API_BASE } from "src/lib/client";

// ══════════════════════════════════════════════════════════════════════════════
//  DYNAMIC API — DOCS & PROMPT MODAL (self-contained with trigger button)
// ══════════════════════════════════════════════════════════════════════════════

export default function DynamicApiDocsModal() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [apiKey] = useApiKey();

  const apiHost = API_BASE ? API_BASE : window.location.origin;
  const displayKey = apiKey.trim() || "YOUR_API_KEY";

  const llmPrompt = `This document provides connection details and API reference to programmatically interact with the Dynamic APIs module.

### Connection & Authentication
- **System**: GomuStack
- **API Base URL**: ${apiHost}/api
- **Authentication**: You must authenticate every HTTP request by including this header:
  - \`X-API-Key: ${displayKey}\`

---

### Overview

Dynamic APIs lets you create custom HTTP endpoints with JavaScript handler functions. Each endpoint is defined by a **method** (GET/POST/PUT/PATCH/DELETE), a **path** (supports \`:param\` placeholders), and a **handler function**.

All dynamic endpoints are served under the \`/apis\` prefix:
\`\`\`
${apiHost}/apis{path}
\`\`\`

---

### Handler Pattern

Every handler MUST use this exact structure:

\`\`\`javascript
export default async function handler(request, context) {
  // request.method  — "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  // request.path    — e.g. "/users/123"
  // request.params  — path params (:id → { id: "123" })
  // request.query   — query string (?page=1 → { page: "1" })
  // request.headers — HTTP request headers
  // request.body    — parsed JSON body (null for GET)
  //
  // context.log(...args) — log to execution logs

  return {
    status: 200,       // HTTP status code
    headers: {},       // optional response headers
    body: { ... }      // response body (auto JSON.stringify)
  };
}
\`\`\`

---

### Management REST API Endpoints

1. **List Dynamic APIs**
   - **Method**: \`GET\`
   - **Path**: \`/dynamic-apis\`
   - **Query Params**:
     - \`search\` (optional): Filter by name or path
     - \`method\` (optional): Filter by HTTP method
     - \`status\` (optional): \`"active"\` | \`"inactive"\`
     - \`page\` (default: 1), \`limit\` (default: 50)
   - **Response**: \`{ items: [...], meta: { total, page, limit } }\`

2. **Create Dynamic API**
   - **Method**: \`POST\`
   - **Path**: \`/dynamic-apis\`
   - **Body (JSON)**:
     \`\`\`json
     {
       "name": "Get Weather",
       "method": "GET",
       "path": "/weather",
       "description": "Fetch weather data",
       "code": "export default async function handler(request, context) { ... }",
       "isPublic": false,
       "timeout": 30000
     }
     \`\`\`
   - **Response**: The created API object

3. **Get Dynamic API by ID**
   - **Method**: \`GET\`
   - **Path**: \`/dynamic-apis/:id\`

4. **Update Dynamic API**
   - **Method**: \`PATCH\`
   - **Path**: \`/dynamic-apis/:id\`
   - **Body**: Any subset of \`{ name, method, path, description, code, draftCode, isActive, isPublic, timeout }\`
   - **Note**: \`code\` is the live/production handler code. \`draftCode\` is a staging area for code being developed or tested (see Draft Code Workflow below).

5. **Delete Dynamic API**
   - **Method**: \`DELETE\`
   - **Path**: \`/dynamic-apis/:id\`

6. **List Execution Logs**
   - **Method**: \`GET\`
   - **Path**: \`/dynamic-apis/:id/logs\`
   - **Query Params**: \`status\`, \`startDate\`, \`endDate\`, \`page\`, \`limit\`

7. **Dry-Run Test**
   - **Method**: \`POST\`
   - **Path**: \`/dynamic-apis/:id/test\`
   - **Body (JSON)**:
     \`\`\`json
     {
       "source": "draft",
       "params": {},
       "query": {},
       "headers": {},
       "body": null,
       "timeout": 30000
     }
     \`\`\`
   - **\`source\`**: \`"draft"\` (default) runs \`draftCode\` from DB (falls back to \`code\`). \`"prod"\` runs the live \`code\`.
   - **Response**: \`{ status, headers, body, consoleLogs, executionTimeMs, executionMode, error? }\`

---

### Draft Code Workflow

Dynamic APIs support a **draft → promote** workflow for safe code development:

1. **Save draft**: \`PATCH /dynamic-apis/:id\` with \`{ draftCode: "<new code>" }\` — saves code as a draft without affecting the live endpoint.
2. **Test draft**: \`POST /dynamic-apis/:id/test\` with \`{ source: "draft" }\` — dry-run the draft code with simulated request data.
3. **Iterate**: Repeat steps 1–2 until the handler works correctly.
4. **Promote to live**: \`PATCH /dynamic-apis/:id\` with \`{ code: "<draft code>", draftCode: "<draft code>" }\` — copy draft to live production code.
5. **Discard draft**: \`PATCH /dynamic-apis/:id\` with \`{ draftCode: "<current code>" }\` — reset draftCode back to the current live code.

---

### Calling Dynamic Endpoints

\`\`\`bash
# Public endpoint (no auth)
curl ${apiHost}/apis/weather

# Private endpoint (needs auth)
curl ${apiHost}/apis/users/123 \\
  -H "Authorization: Bearer YOUR_TOKEN"

# POST with body
curl -X POST ${apiHost}/apis/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"name": "John", "email": "john@example.com"}'
\`\`\`
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
            <div className="font-display text-[20px] md:text-[24px] tracking-tight text-ink font-normal leading-tight">Connect LLM to Dynamic APIs</div>
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
                <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium">llm-dynamic-apis-instructions.md</span>
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
