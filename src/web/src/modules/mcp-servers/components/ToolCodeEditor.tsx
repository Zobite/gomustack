import Editor, { type Monaco } from "@monaco-editor/react";
import { Dropdown } from "antd";
import { BookOpen, Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";
import { SafeDiffEditor } from "../../../lib/SafeDiffEditor";
import { installMonacoErrorSuppressor } from "../../../lib/monaco-error-suppressor";

installMonacoErrorSuppressor();

type MonacoInstance = Parameters<NonNullable<React.ComponentProps<typeof Editor>["onMount"]>>[1];
type ITextModel = Parameters<Parameters<ReturnType<MonacoInstance["languages"]["registerCompletionItemProvider"]>["provideCompletionItems"]>>[0];
type IPosition = Parameters<Parameters<ReturnType<MonacoInstance["languages"]["registerCompletionItemProvider"]>["provideCompletionItems"]>>[1];

// ── Example Snippets ────────────────────────────────────────────────────────

const EXAMPLES = [
  {
    label: "1. Hello World",
    key: "hello",
    code: `/**
 * @name hello_world
 * @description A simple hello world tool that returns a timestamp
 * @param {string} name (optional) - The name of the person to greet
 */
export default async function execute(params, context) {
  const { name = "World" } = params;
  context.log("Hello from MCP tool!");

  return {
    message: \`Hello \${name}\`,
    timestamp: Date.now()
  };
}`,
  },
  {
    label: "2. Echo Params",
    key: "echo",
    code: `/**
 * @name echo_params
 * @description Echoes back the parameters received from the agent
 * @param {object} input (required) - Any JSON object to echo back
 */
export default async function execute(params, context) {
  context.log("Received params:", params);

  return {
    echo: params.input,
    receivedAt: new Date().toISOString()
  };
}`,
  },
  {
    label: "3. Fetch External API",
    key: "fetch",
    code: `/**
 * @name get_weather
 * @description Fetch real-time weather temperature for Hanoi or other coordinate
 * @param {string} city (optional) - City name to fetch weather for
 */
export default async function execute(params, context) {
  const { city } = params;

  const res = await fetch(
    "https://api.open-meteo.com/v1/forecast?latitude=21.03&longitude=105.85&current_weather=true"
  );
  const data = await res.json();

  context.log("Weather fetched:", data.current_weather?.temperature);

  return {
    city: city || "Hanoi",
    temperature: data.current_weather?.temperature,
    windspeed: data.current_weather?.windspeed,
    time: data.current_weather?.time
  };
}`,
  },
  {
    label: "4. KV Store",
    key: "kv",
    code: `/**
 * @name manage_variable
 * @description Store or retrieve key-value pairs from the global KV store
 * @param {string} action (required) - Action to perform (get or set)
 * @param {string} key (required) - Key of the variable
 * @param {string} value (optional) - Value to store (required if action is set)
 */
export default async function execute(params, context) {
  const { action, key, value } = params;

  if (action === "set") {
    await context.kv.set(key, value);
    context.log("Saved:", key, "=", value);
    return { saved: true, key, value };
  }

  const result = await context.kv.get(key);
  context.log("Read:", key, "→", result);
  return { key, result };
}`,
  },
  {
    label: "5. With npm (lodash)",
    key: "lodash",
    code: `/**
 * @name group_items
 * @description Groups a list of items by their category and calculates pricing
 * @param {object[]} items (required) - List of items to analyze
 * @param {string} items[].name (required) - Item name
 * @param {string} items[].category (required) - Item category
 * @param {number} items[].price (required) - Item price
 */
import _ from "lodash";

export default async function execute(params, context) {
  const items = params.items || [];
  const sorted = _.sortBy(items, "name");
  const grouped = _.groupBy(sorted, "category");
  const avgPrice = _.meanBy(items, "price");

  context.log(\`Processed \${items.length} items, avg: \${avgPrice}\`);

  return {
    total: items.length,
    avgPrice: _.round(avgPrice, 2),
    categories: _.mapValues(grouped, g => ({
      count: g.length,
      items: _.map(g, "name")
      }))
  };
}`,
  },
];

// ── Constants ────────────────────────────────────────────────────────────────

const TOOL_EDITOR_PATH = "mcp-tool-editor.js";

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  lineHeight: 1.6,
  padding: { top: 12, bottom: 12 },
  tabSize: 2,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  stickyScroll: { enabled: false },
  wordWrap: "off" as const,
  renderLineHighlight: "line" as const,
  cursorBlinking: "smooth" as const,
  smoothScrolling: true,
  bracketPairColorization: { enabled: true },
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
  fontLigatures: true,
  quickSuggestions: true,
  suggestOnTriggerCharacters: true,
  wordBasedSuggestions: "off" as const,
};

const DIFF_EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  lineHeight: 1.6,
  padding: { top: 12, bottom: 48 },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  readOnly: true,
  renderSideBySide: false,
  wordWrap: "off" as const,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
  fontLigatures: true,
};

// ── Monaco Providers ────────────────────────────────────────────────────────

let providersRegistered = false;

function registerProviders(monaco: Monaco) {
  if (providersRegistered) return;
  providersRegistered = true;

  const jsDefaults = monaco.languages.typescript.javascriptDefaults;
  jsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
    diagnosticCodesToIgnore: [80005, 2307, 8023, 8024],
  });
  jsDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    allowJs: true,
    checkJs: true,
    strict: false,
  });

  jsDefaults.addExtraLib(`declare module "*";`, "wildcard-modules.d.ts");

  jsDefaults.addExtraLib(
    `declare var params: Record<string, any>;
declare var context: {
  log(...args: any[]): void;
  http: {
    get(url: string, headers?: Record<string, string>): Promise<any>;
    post(url: string, data?: any, headers?: Record<string, string>): Promise<any>;
    patch(url: string, data?: any, headers?: Record<string, string>): Promise<any>;
    delete(url: string, headers?: Record<string, string>): Promise<any>;
  };
  kv: {
    get(key: string): Promise<any>;
    set(key: string, value: any, ttl?: number): Promise<any>;
  };
  tables: {
    query(projectId: string, tableId: string, filters?: any, page?: number, limit?: number): Promise<any>;
    insert(projectId: string, tableId: string, data: any): Promise<any>;
  };
};`,
    "tool-globals.d.ts",
  );

  (jsDefaults as any).setModeConfiguration?.({
    completionItems: false,
    hovers: false,
    signatureHelp: false,
    definitions: false,
    references: false,
    documentHighlights: false,
    rename: false,
    documentSymbols: false,
    codeActions: false,
    inlayHints: false,
    diagnostics: true,
  });

  const { CompletionItemKind, CompletionItemInsertTextRule } = monaco.languages;

  const contextProps = [
    { label: "log", type: "(...args: any[]) => void", doc: "Log for debugging output", snippet: "log(${1})" },
    { label: "http", type: "HttpHelper", doc: "HTTP client for internal/external API calls" },
    { label: "kv", type: "KvHelper", doc: "KV Store read/write" },
    { label: "tables", type: "TablesHelper", doc: "DataTable query/insert" },
  ];

  const httpMethods = [
    { label: "get", type: "(url: string, headers?: Record<string, string>) => Promise<any>", doc: "HTTP GET request", snippet: 'get("${1}")' },
    { label: "post", type: "(url: string, data?: any) => Promise<any>", doc: "HTTP POST request", snippet: 'post("${1}", ${2:{}})' },
    { label: "patch", type: "(url: string, data?: any) => Promise<any>", doc: "HTTP PATCH request", snippet: 'patch("${1}", ${2:{}})' },
    { label: "delete", type: "(url: string) => Promise<any>", doc: "HTTP DELETE request", snippet: 'delete("${1}")' },
  ];

  const kvMethods = [
    { label: "get", type: "(key: string) => Promise<any>", doc: "Get a value by key", snippet: 'get("${1}")' },
    { label: "set", type: "(key: string, value: any, ttl?: number) => Promise<any>", doc: "Set a value", snippet: 'set("${1}", ${2})' },
  ];

  const tablesMethods = [
    { label: "query", type: "(projectId, tableId, filters?, page?, limit?) => Promise<any>", doc: "Query table rows", snippet: 'query("${1}", "${2}")' },
    { label: "insert", type: "(projectId, tableId, data) => Promise<any>", doc: "Insert rows into table", snippet: 'insert("${1}", "${2}", ${3:{}})' },
  ];

  monaco.languages.registerCompletionItemProvider("javascript", {
    triggerCharacters: ["."],
    provideCompletionItems: (model: ITextModel, position: IPosition) => {
      if (!model.uri.path.includes("mcp-tool-editor")) return { suggestions: [] };
      const line = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // context.http.
      if (/\bcontext\.http\.\w*$/.test(line)) {
        return {
          suggestions: httpMethods.map((p, i) => ({
            label: p.label,
            kind: CompletionItemKind.Method,
            detail: `(method) ${p.type}`,
            documentation: p.doc,
            insertText: p.snippet || p.label,
            insertTextRules: p.snippet ? CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            sortText: `!${String(i).padStart(2, "0")}`,
            range,
          })),
        };
      }

      // context.kv.
      if (/\bcontext\.kv\.\w*$/.test(line)) {
        return {
          suggestions: kvMethods.map((p, i) => ({
            label: p.label,
            kind: CompletionItemKind.Method,
            detail: `(method) ${p.type}`,
            documentation: p.doc,
            insertText: p.snippet || p.label,
            insertTextRules: p.snippet ? CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            sortText: `!${String(i).padStart(2, "0")}`,
            range,
          })),
        };
      }

      // context.tables.
      if (/\bcontext\.tables\.\w*$/.test(line)) {
        return {
          suggestions: tablesMethods.map((p, i) => ({
            label: p.label,
            kind: CompletionItemKind.Method,
            detail: `(method) ${p.type}`,
            documentation: p.doc,
            insertText: p.snippet || p.label,
            insertTextRules: p.snippet ? CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            sortText: `!${String(i).padStart(2, "0")}`,
            range,
          })),
        };
      }

      // context.
      if (/\bcontext\.\w*$/.test(line)) {
        return {
          suggestions: contextProps.map((p, i) => ({
            label: p.label,
            kind: p.label === "log" ? CompletionItemKind.Method : CompletionItemKind.Property,
            detail: `(${p.label === "log" ? "method" : "property"}) ${p.type}`,
            documentation: p.doc,
            insertText: (p as any).snippet || p.label,
            insertTextRules: (p as any).snippet ? CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            sortText: `!${String(i).padStart(2, "0")}`,
            range,
          })),
        };
      }

      return { suggestions: [] };
    },
  });

  // ── HoverProvider ───────────────────────────────────────────────────────
  monaco.languages.registerHoverProvider("javascript", {
    provideHover: (model: ITextModel, position: IPosition) => {
      if (!model.uri.path.includes("mcp-tool-editor")) return null;
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const lineContent = model.getLineContent(position.lineNumber);
      const before = lineContent.substring(0, word.startColumn - 1);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      if (word.word === "execute" && !before.endsWith(".")) {
        return {
          range,
          contents: [
            { value: "```typescript\nasync function execute(\n  params: Record<string, any>,\n  context: ToolContext\n): Promise<any>\n```" },
            { value: "MCP Tool entry point. Return a JSON-serializable value." },
          ],
        };
      }

      if (word.word === "params" && !before.endsWith(".")) {
        return {
          range,
          contents: [
            { value: "```typescript\n(parameter) params: Record<string, any>\n```" },
            { value: "Input parameters from AI agent, matching the tool's input schema." },
          ],
        };
      }

      if (word.word === "context" && !before.endsWith(".")) {
        return {
          range,
          contents: [
            { value: "```typescript\n(parameter) context: ToolContext\n```" },
            {
              value:
                "```typescript\ninterface ToolContext {\n  log(...args: any[]): void;\n  http: HttpHelper;\n  kv: KvHelper;\n  tables: TablesHelper;\n}\n```",
            },
          ],
        };
      }

      return null;
    },
  });
}

// ── Component ───────────────────────────────────────────────────────────────

interface ToolCodeEditorProps {
  value: string;
  onChange: (code: string) => void;
  pendingCode?: string | null;
  onAcceptPending?: () => void;
  onRejectPending?: () => void;
}

export function ToolCodeEditor({ value, onChange, pendingCode, onAcceptPending, onRejectPending }: ToolCodeEditorProps) {
  const hasPending = !!pendingCode && pendingCode !== value;

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    registerProviders(monaco);
  }, []);

  const menuItems = useMemo(
    () =>
      EXAMPLES.map((ex) => ({
        key: ex.key,
        label: <span className="font-mono text-[12px]">{ex.label}</span>,
        onClick: () => onChange(ex.code.trim()),
      })),
    [onChange],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between shrink-0 px-3 py-2">
        <div className="flex items-center gap-2">
          <label className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">Tool Code (JavaScript)</label>
          {hasPending && <span className="font-mono text-[10px] text-[#8b5cf6] bg-[#8b5cf620] px-1.5 py-0.5 rounded">AI Changes Pending</span>}
        </div>{" "}
        <div className="flex items-center gap-1.5">
          <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
            <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-muted-soft bg-transparent border border-hairline hover:border-hairline-strong hover:text-ink transition-colors cursor-pointer">
              <BookOpen size={11} />
              Examples
            </button>
          </Dropdown>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden border border-hairline relative">
        {hasPending ? (
          <div className="w-full h-full">
            <SafeDiffEditor original={value} modified={pendingCode || ""} language="javascript" theme="vs-dark" options={DIFF_EDITOR_OPTIONS} />
          </div>
        ) : (
          <div className="w-full h-full">
            <Editor
              defaultLanguage="javascript"
              path={TOOL_EDITOR_PATH}
              value={value}
              onChange={(v) => onChange(v ?? "")}
              theme="vs-dark"
              beforeMount={handleBeforeMount}
              options={EDITOR_OPTIONS}
            />
          </div>
        )}

        {hasPending && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-2.5 py-2 rounded-md bg-[#181818] border border-[#2d2d2d] shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            <button
              onClick={onAcceptPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[12px] font-medium text-[#1f8a65] bg-[#1f8a6515] border border-[#1f8a6530] hover:bg-[#1f8a6525] cursor-pointer transition-colors"
            >
              <Check size={12} className="text-[#1f8a65]" />
              Accept
            </button>
            <button
              onClick={onRejectPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[12px] font-medium text-[#cf2d56] bg-[#cf2d5615] border border-[#cf2d5630] hover:bg-[#cf2d5625] cursor-pointer transition-colors"
            >
              <X size={12} className="text-[#cf2d56]" />
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
