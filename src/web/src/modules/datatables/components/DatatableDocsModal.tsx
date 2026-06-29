import { Modal, message } from "antd";
import { BookOpen, Check, Copy } from "lucide-react";
import { useState } from "react";
import ApiKeyInput from "src/common/components/ApiKeyInput";
import { useApiKey } from "src/common/hooks/useApiKey";
import { API_BASE } from "src/lib/client";
import type { DynamicTable, ProjectItem } from "src/lib/types";

interface DatatableDocsModalProps {
  open: boolean;
  onClose: () => void;
  project: ProjectItem;
  tables: DynamicTable[];
}

export default function DatatableDocsModal({ open, onClose, project, tables }: DatatableDocsModalProps) {
  const [copied, setCopied] = useState(false);
  const [apiKey] = useApiKey();

  const apiHost = API_BASE ? API_BASE : window.location.origin;
  const displayKey = apiKey.trim() || "YOUR_API_KEY";

  // Build the context schema string for the prompt
  const schemaDescription =
    tables.length > 0
      ? tables
          .map((table) => {
            const cols = [...table.columns].sort((a, b) => a.order - b.order);
            const colLines = cols.map((c) => `      - \`${c.id}\` ("${c.name}", type: \`${c.type}\`)`).join("\n");
            return `  - **${table.name}** (Table ID: \`${table.id}\`)
    Columns:
${colLines}`;
          })
          .join("\n\n")
      : "  - (No tables registered in this project yet)";

  const llmPrompt = `This document provides connection details and API reference to programmatically interact with Project "${project.name}" (ID: \`${project.id}\`) of the DataTables module.

### Connection & Authentication
- **System**: GomuStack
- **API Base URL**: ${apiHost}/api
- **Authentication**: You must authenticate every HTTP request by including this header:
  - \`X-API-Key: ${displayKey}\`

### Current Workspace Context (Direct Data)
- **Active Project ID**: \`${project.id}\` (Name: "${project.name}")

- **Tables inside this project**:
${schemaDescription}

### REST API Endpoints (DataTables)

1. **Execute MQL Query (Listing, Filtering, Sorting & Pagination)**
   - **Method**: \`POST\`
   - **Path**: \`/datatables/${project.id}/tables/:tableId/query\`
   - **Body (JSON)**:
     \`\`\`json
     {
       "q": "SELECT Name, Email WHERE Age > 18 AND City = 'HCM' ORDER BY Name ASC LIMIT 10"
     }
     \`\`\`
   - **Response**: \`{ items: [{ id, data: { ... } }], meta: { total, limit, offset, hasMore } }\`
   
   *MQL (GomuStack Query Language) is a secure, SQL-like DSL designed for structured row querying. You must use it for listing, pagination, filtering, and sorting.*
   
   **Common MQL Examples:**
   - **List Page 1 (Limit 50)**:
     \`"LIMIT 50"\` or \`"SELECT col_a, col_b LIMIT 50"\`
   - **List Page 3 (Limit 20, Offset 40)**:
     \`"LIMIT 20 OFFSET 40"\`
   - **Filter and Sort**:
     \`"WHERE col_status = 'active' ORDER BY created_at DESC LIMIT 10"\`
   - **Keyword Search**:
     \`"WHERE col_name LIKE '%john%'"\`
   - **Check Multiple Values**:
     \`"WHERE col_role IN ('admin', 'manager')"\`
   - **Count Rows (no data items returned)**:
     \`"COUNT WHERE col_status = 'pending'"\`

2. **Create a New Row**
   - **Method**: \`POST\`
   - **Path**: \`/datatables/${project.id}/tables/:tableId/rows\`
   - **Body (JSON)**:
     \`\`\`json
     {
       "data": {
         "col_xxx": "John Doe",  // Use the Column IDs listed under Workspace Context
         "col_yyy": 30
       }
     }
     \`\`\`
   - **Response**: \`{ id, data: { ... }, createdAt, updatedAt }\`

3. **Update an Existing Row**
   - **Method**: \`PATCH\`
   - **Path**: \`/datatables/${project.id}/tables/:tableId/rows/:rowId\`
   - **Body (JSON)**:
     \`\`\`json
     {
       "data": {
         "col_xxx": "Updated Name"
       }
     }
     \`\`\`
   - **Response**: \`{ id, data: { ... }, createdAt, updatedAt }\`

4. **Delete a Row**
   - **Method**: \`DELETE\`
   - **Path**: \`/datatables/${project.id}/tables/:tableId/rows/:rowId\`
   - **Response**: \`{ deleted: true }\`
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
          <div className="font-display text-[20px] md:text-[24px] tracking-tight text-ink font-normal leading-tight">Connect LLM to Datatable</div>
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
              <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium">llm-datatable-instructions.md</span>
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
