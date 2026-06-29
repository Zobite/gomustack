import { App } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import type { McpToolLog, McpToolTestResult } from "src/lib/types";

// ── Default JSDoc Code Template ─────────────────────────────────────────────

const DEFAULT_CODE = `/**
 * @name my_tool
 * @description Describe what this tool does
 * @param {string} query (required) - A search query
 */
export default async function execute(params, context) {
  /**
   * params: object — input parameters from AI agent (matches parameters annotated above)
   * context: object — SDK for accessing internal services
   *   - context.log(...args)           — debug logging
   *   - context.http.get(url)          — HTTP GET
   *   - context.http.post(url, data)   — HTTP POST
   *   - context.kv.get(key)           — KV Store: read
   *   - context.kv.set(key, v)        — KV Store: write
   *   - context.tables.query(pid, tid) — DataTables: query
   *   - context.tables.insert(pid, tid, data) — DataTables: insert
   */
  context.log("Executing my_tool with params:", params);

  return { result: "Hello from my_tool!" };
}
`;

const DEFAULT_INPUT_SCHEMA = `{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "A search query"
    }
  },
  "required": ["query"]
}`;

// ── JSDoc Parser and Generator Helpers ────────────────────────────────────────

interface ParsedMetadata {
  name: string;
  description: string;
  inputSchema: string;
  error?: string;
}

export function parseToolCode(code: string): ParsedMetadata {
  try {
    const lines = code.split("\n");
    const commentLines: string[] = [];

    // Strategy: scan the entire file for all JSDoc blocks.
    // Collect lines from the block that contains @name/@description/@param tags.
    // This handles cases where import statements appear before the JSDoc block.
    const allBlocks: string[][] = [];
    let currentBlock: string[] = [];
    let inJSDocBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("/**")) {
        inJSDocBlock = true;
        currentBlock = [];
        continue;
      }
      if (trimmed.endsWith("*/") && inJSDocBlock) {
        inJSDocBlock = false;
        allBlocks.push(currentBlock);
        currentBlock = [];
        continue;
      }
      if (inJSDocBlock) {
        const match = trimmed.match(/^\*\s*(.*)$/);
        if (match) {
          currentBlock.push(match[1]);
        } else {
          currentBlock.push(trimmed);
        }
      }
    }

    // Find the JSDoc block that contains tool metadata (@name or @param)
    const metaBlock = allBlocks.find((block) => block.some((l) => l.trim().startsWith("@name") || l.trim().startsWith("@param")));

    if (metaBlock) {
      commentLines.push(...metaBlock);
    } else {
      // Fallback: scan top-of-file single-line comments (// or #) before any code
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//")) {
          commentLines.push(trimmed.slice(2).trim());
        } else if (trimmed.startsWith("#")) {
          commentLines.push(trimmed.slice(1).trim());
        } else if (trimmed !== "" && !trimmed.startsWith("import") && !trimmed.startsWith("/**")) {
          break;
        }
      }
    }

    let name = "";
    let description = "";
    const params: Array<{
      name: string;
      type: string;
      required: boolean;
      description: string;
    }> = [];

    for (const rawLine of commentLines) {
      const line = rawLine.trim();
      if (line.startsWith("@name")) {
        name = line.slice(5).trim();
      } else if (line.startsWith("@description")) {
        description = line.slice(12).trim();
      } else if (line.startsWith("@param")) {
        // @param {type} path (required/optional) - desc
        const paramMatch = line.match(/^@param\s*\{([^}]+)\}\s*([^\s(-]+)\s*(?:\((required|optional)\))?\s*-?\s*(.*)$/i);
        if (paramMatch) {
          params.push({
            name: paramMatch[2].trim(),
            type: paramMatch[1].trim(),
            required: paramMatch[3]?.toLowerCase() === "required",
            description: paramMatch[4]?.trim() || "",
          });
        }
      }
    }

    if (!name) {
      name = "unnamed_tool";
    } else {
      name = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "");
    }

    // ── Build JSON Schema from flat @param declarations ──────────────────────

    const schema: any = { type: "object", properties: {}, required: [] };

    const mapType = (t: string): string => {
      const lt = t.toLowerCase();
      if (lt === "string") return "string";
      if (["number", "float", "double", "int", "integer"].includes(lt)) return "number";
      if (lt === "boolean" || lt === "bool") return "boolean";
      if (lt === "object") return "object";
      if (lt === "array") return "array";
      return "string";
    };

    /**
     * Supports paths like:
     *   query           → top-level string
     *   filters.category → nested object
     *   items[].name    → array of objects with property "name"
     */
    const setDeepProperty = (root: any, path: string, type: string, required: boolean, desc: string) => {
      // Split path: "items[].name" → [{key:"items",isArray:true}, {key:"name",isArray:false}]
      const parts: Array<{ key: string; isArray: boolean }> = [];
      for (const seg of path.split(".")) {
        if (seg.endsWith("[]")) {
          parts.push({ key: seg.slice(0, -2), isArray: true });
        } else {
          parts.push({ key: seg, isArray: false });
        }
      }

      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const { key, isArray } = parts[i];
        const isLast = i === parts.length - 1;
        const typeIsArray = type.endsWith("[]") || type.toLowerCase() === "array";

        if (!current.properties) {
          current.properties = {};
        }
        if (!current.required) {
          current.required = [];
        }

        // Determine if this segment should be an array
        const existingProp = current.properties?.[key];
        const shouldBeArray = isArray || existingProp?.type === "array" || (isLast && typeIsArray);

        if (shouldBeArray) {
          // Ensure the array wrapper exists
          if (!current.properties[key]) {
            current.properties[key] = {
              type: "array",
              description: isLast ? desc : undefined,
              items: { type: "object", properties: {}, required: [] },
            };
          }
          if (required && !current.required.includes(key)) {
            current.required.push(key);
          }

          if (isLast) {
            // This line declares the array itself (e.g. @param {object[]} items)
            const scalarType = type.endsWith("[]") ? type.slice(0, -2) : type;
            if (scalarType.toLowerCase() === "object") {
              // Keep items as object container
              if (!current.properties[key].items?.properties) {
                current.properties[key].items = {
                  type: "object",
                  properties: {},
                  required: [],
                };
              }
            } else {
              current.properties[key].items = { type: mapType(scalarType) };
            }
            if (desc) current.properties[key].description = desc;
          } else {
            // Traverse into items
            if (!current.properties[key].items?.properties) {
              current.properties[key].items = {
                type: "object",
                properties: {},
                required: [],
              };
            }
            current = current.properties[key].items;
          }
        } else if (isLast) {
          // Leaf property
          current.properties[key] = { type: mapType(type), description: desc };
          if (required && !current.required.includes(key)) {
            current.required.push(key);
          }
        } else {
          // Intermediate object
          if (!current.properties[key] || typeof current.properties[key] !== "object") {
            current.properties[key] = {
              type: "object",
              properties: {},
              required: [],
            };
          }
          if (current.properties[key].type !== "object" && current.properties[key].type !== "array") {
            current.properties[key].type = "object";
          }
          if (!current.properties[key].properties) {
            current.properties[key].properties = {};
          }
          if (!current.properties[key].required) {
            current.properties[key].required = [];
          }

          if (required && !current.required.includes(key)) {
            current.required.push(key);
          }
          current = current.properties[key];
        }
      }
    };

    for (const p of params) {
      setDeepProperty(schema, p.name, p.type, p.required, p.description);
    }

    // Clean up empty required arrays
    const cleanSchema = (obj: any) => {
      if (obj.type === "object") {
        if (obj.required?.length === 0) obj.required = undefined;
        if (obj.properties) {
          for (const k in obj.properties) cleanSchema(obj.properties[k]);
        }
      } else if (obj.type === "array" && obj.items) {
        if (obj.items.required?.length === 0) obj.items.required = undefined;
        cleanSchema(obj.items);
      }
      if (obj.description === undefined) obj.description = undefined;
    };
    cleanSchema(schema);

    return { name, description, inputSchema: JSON.stringify(schema, null, 2) };
  } catch (err: any) {
    // Suppress console.error during active typing/rendering to prevent console spam
    return {
      name: "unnamed_tool",
      description: "",
      inputSchema: "{}",
      error: err?.message || "Unknown JSDoc parsing error",
    };
  }
}

/**
 * Normalize tool code: ensure JSDoc block (@name/@param) is always at the top,
 * followed by import statements, then the rest of the code.
 * Convention: JSDoc metadata comment must always be the first thing in the file.
 */
export function normalizeToolCode(code: string): string {
  const lines = code.split("\n");

  // Find the JSDoc block containing @name or @param
  let jsdocStart = -1;
  let jsdocEnd = -1;
  let inBlock = false;
  let foundMeta = false;
  let blockStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("/**")) {
      inBlock = true;
      blockStart = i;
      foundMeta = false;
    }
    if (inBlock && (trimmed.includes("@name") || trimmed.includes("@param"))) {
      foundMeta = true;
    }
    if (trimmed.endsWith("*/") && inBlock) {
      inBlock = false;
      if (foundMeta) {
        jsdocStart = blockStart;
        jsdocEnd = i;
        break;
      }
    }
  }

  // If no metadata JSDoc found, or it's already at the top, return as-is
  if (jsdocStart <= 0) return code;

  // Check if there's only whitespace/imports before the JSDoc block
  const beforeJsdoc = lines.slice(0, jsdocStart);
  const hasCodeBefore = beforeJsdoc.some((l) => {
    const t = l.trim();
    return t !== "" && !t.startsWith("import ") && !t.startsWith("import{");
  });

  // Only reorder if the stuff before JSDoc is just imports (not arbitrary code)
  if (hasCodeBefore) return code;

  // Extract parts
  const importLines = beforeJsdoc.filter((l) => l.trim() !== "");
  const jsdocLines = lines.slice(jsdocStart, jsdocEnd + 1);
  const afterJsdoc = lines.slice(jsdocEnd + 1);

  // Rebuild: JSDoc first → imports → rest of code
  const result: string[] = [];
  result.push(...jsdocLines);
  if (importLines.length > 0) {
    result.push(...importLines);
    // Add blank line after imports if the next line isn't blank
    if (afterJsdoc.length > 0 && afterJsdoc[0].trim() !== "") {
      result.push("");
    }
  }
  result.push(...afterJsdoc);

  return result.join("\n");
}

/**
 * Generate JSDoc header from schema — uses flat `items[].name` notation.
 */
export function generateJSDocHeader(name: string, description: string, schemaStr: string): string {
  let doc = "/**\n";
  doc += ` * @name ${name}\n`;
  if (description) {
    doc += ` * @description ${description}\n`;
  }

  try {
    const schema = JSON.parse(schemaStr);

    const emit = (obj: any, prefix: string) => {
      if (!obj.properties) return;
      for (const k in obj.properties) {
        const prop = obj.properties[k];
        const isReq = obj.required?.includes(k) ? "required" : "optional";
        const desc = prop.description || "";
        const path = prefix ? `${prefix}.${k}` : k;

        if (prop.type === "array") {
          if (prop.items?.type === "object") {
            doc += ` * @param {object[]} ${path} (${isReq}) - ${desc}\n`;
            emit(prop.items, `${path}[]`);
          } else {
            const itemType = prop.items?.type || "string";
            doc += ` * @param {${itemType}[]} ${path} (${isReq}) - ${desc}\n`;
          }
        } else if (prop.type === "object" && prop.properties) {
          doc += ` * @param {object} ${path} (${isReq}) - ${desc}\n`;
          emit(prop, path);
        } else {
          doc += ` * @param {${prop.type || "string"}} ${path} (${isReq}) - ${desc}\n`;
        }
      }
    };

    emit(schema, "");
  } catch {
    // Ignore invalid JSON schema
  }

  doc += " */\n";
  return doc;
}

// ── Hook Definition ─────────────────────────────────────────────────────────

export function useToolEditor() {
  const { message, modal } = App.useApp();
  const { id: serverId, toolId } = useParams<{ id: string; toolId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<McpToolTestResult | null>(null);
  const [rightPanel, setRightPanel] = useState<"test" | "logs" | "ai">("test");
  const [logs, setLogs] = useState<McpToolLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [code, setCode] = useState(DEFAULT_CODE);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [inputSchema, setInputSchema] = useState(DEFAULT_INPUT_SCHEMA);
  const [testParams, setTestParams] = useState("{}");
  const [toolName, setToolName] = useState("");
  const [toolDescription, setToolDescription] = useState("");
  const savedCodeRef = useRef(DEFAULT_CODE);
  const isDirty = code !== savedCodeRef.current;

  // ── Fetch tool ───────────────────────────────────────────────────────────

  const fetchTool = useCallback(async () => {
    if (!serverId || !toolId) return;
    setLoading(true);
    try {
      const tool = await client.mcpToolServers.getTool(serverId, toolId);

      // If tool has code, prepend JSDoc if missing; otherwise use default template with tool name
      let finalCode = tool.code;
      if (!finalCode) {
        // Tool was just created with no code — generate default template with its name
        const header = generateJSDocHeader(tool.name, tool.description || "Describe what this tool does", tool.inputSchema || "{}");
        finalCode =
          header +
          `export default async function execute(params, context) {
  /**
   * params: object — input parameters from AI agent (matches parameters annotated above)
   * context: object — SDK for accessing internal services
   *   - context.log(...args)           — debug logging
   *   - context.http.get(url)          — HTTP GET
   *   - context.http.post(url, data)   — HTTP POST
   *   - context.kv.get(key)           — KV Store: read
   *   - context.kv.set(key, v)        — KV Store: write
   *   - context.tables.query(pid, tid) — DataTables: query
   *   - context.tables.insert(pid, tid, data) — DataTables: insert
   */
  context.log("Executing ${tool.name} with params:", params);

  return { result: "Hello from ${tool.name}!" };
}
`;
      } else if (!finalCode.includes("@name")) {
        const header = generateJSDocHeader(tool.name, tool.description, tool.inputSchema || "{}");
        finalCode = header + finalCode;
      }

      setCode(finalCode);
      savedCodeRef.current = finalCode;
      setToolName(tool.name);
      setToolDescription(tool.description);
      setInputSchema(tool.inputSchema || DEFAULT_INPUT_SCHEMA);

      // If there's a pending draft from AI, show it as a diff
      if (tool.draftCode && tool.draftCode !== tool.code) {
        setPendingCode(tool.draftCode);
      }
    } catch {
      message.error("Failed to load tool");
      navigate(`/mcp-servers/${serverId}`);
    } finally {
      setLoading(false);
    }
  }, [serverId, toolId, navigate, message.error]);

  useEffect(() => {
    fetchTool();
  }, [fetchTool]);

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async (codeOverride?: string): Promise<boolean> => {
    // Normalize code: ensure JSDoc is always at top, imports after
    const codeToSave = normalizeToolCode(codeOverride ?? code);
    try {
      const meta = parseToolCode(codeToSave);
      if (meta.error) {
        message.error(`JSDoc parsing error: ${meta.error}`);
        return false;
      }

      setSaving(true);
      await client.mcpToolServers.updateTool(serverId!, toolId!, {
        name: meta.name,
        description: meta.description,
        inputSchema: meta.inputSchema,
        code: codeToSave,
        draftCode: codeToSave, // Keep draft in sync with prod
      });
      message.success("Tool saved");
      savedCodeRef.current = codeToSave;
      // Update editor with normalized code (JSDoc moved to top)
      setCode(codeToSave);
      setToolName(meta.name);
      setToolDescription(meta.description);
      setInputSchema(meta.inputSchema);
      return true;
    } catch (err) {
      if (err instanceof GomuStackError) {
        message.error(err.message);
      } else {
        console.error("[ToolEditor] Save failed:", err);
        if (err instanceof Error) {
          message.error(err.message);
        } else {
          message.error("Failed to save tool");
        }
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ── Test ─────────────────────────────────────────────────────────────────

  const handleTest = async () => {
    if (!serverId || !toolId) {
      message.warning("Save the tool first before testing");
      return;
    }
    setTesting(true);
    setTestResult(null);
    setRightPanel("test");
    try {
      const params = JSON.parse(testParams);
      const result = await client.mcpToolServers.testTool(serverId, toolId, params);
      setTestResult(result);
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
      else if (err instanceof SyntaxError) message.error("Invalid JSON in test params");
    } finally {
      setTesting(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = () => {
    if (!serverId || !toolId) return;
    modal.confirm({
      title: "Delete Tool",
      content: `Delete this tool? This action cannot be undone.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await client.mcpToolServers.deleteTool(serverId, toolId);
          message.success("Tool deleted");
          navigate(`/mcp-servers/${serverId}`);
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  // ── Logs ─────────────────────────────────────────────────────────────────

  const fetchLogs = useCallback(async () => {
    if (!serverId || !toolId) return;
    setLogsLoading(true);
    try {
      const result = await client.mcpToolServers.listToolLogs(serverId, toolId);
      setLogs(result.items);
    } catch {
      message.error("Failed to load logs");
    } finally {
      setLogsLoading(false);
    }
  }, [serverId, toolId, message.error]);

  useEffect(() => {
    if (rightPanel === "logs") fetchLogs();
  }, [rightPanel, fetchLogs]);

  // ── Pending code (from AI) ───────────────────────────────────────────────

  const handleAcceptPending = async () => {
    if (pendingCode) {
      const codeToSave = pendingCode;
      const success = await handleSave(codeToSave);
      if (success) {
        // Defer DiffEditor unmount by 1 frame so Monaco's DiffEditorWidget
        // can dispose its internal models before React removes the DOM element.
        // This prevents "TextModel got disposed before DiffEditorWidget model got reset".
        requestAnimationFrame(() => {
          setPendingCode(null);
        });
      }
    }
  };

  const handleRejectPending = async () => {
    // Defer DiffEditor unmount by 1 frame (same reason as accept)
    requestAnimationFrame(() => {
      setPendingCode(null);
    });
    // Reset draftCode back to prod code in DB
    if (serverId && toolId) {
      client.mcpToolServers.updateTool(serverId, toolId, { draftCode: savedCodeRef.current }).catch(() => {});
    }
  };

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return {
    serverId,
    toolId,
    loading,
    saving,
    isDirty,
    testing,
    testResult,
    rightPanel,
    setRightPanel,
    logs,
    logsLoading,
    expandedLogId,
    setExpandedLogId,

    code,
    setCode,
    pendingCode,
    setPendingCode,
    inputSchema,
    setInputSchema,
    testParams,
    setTestParams,
    toolName,
    toolDescription,
    handleSave,
    handleTest,
    handleDelete,
    handleAcceptPending,
    handleRejectPending,
    fetchLogs,
    navigate,
  };
}
