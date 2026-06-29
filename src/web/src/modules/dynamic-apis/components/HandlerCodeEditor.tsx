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
    code: `export default async function handler(request, context) {
  context.log("Hello from handler!");

  return {
    status: 200,
    body: { message: "Hello World", timestamp: Date.now() }
  };
}`,
  },
  {
    label: "2. Echo (params + body)",
    key: "echo",
    code: `export default async function handler(request, context) {
  context.log("Method:", request.method, "Path:", request.path);

  return {
    status: 200,
    body: {
      method: request.method,
      path: request.path,
      query: request.query,
      body: request.body,
      params: request.params
    }
  };
}`,
  },
  {
    label: "3. CRUD Router",
    key: "crud",
    code: `// Route: /items/:id  (GET, POST, DELETE)
export default async function handler(request, context) {
  const { id } = request.params;

  if (request.method === "GET") {
    const items = {
      "1": { name: "Laptop", price: 999 },
      "2": { name: "Phone", price: 699 }
    };
    const item = items[id];
    if (!item) return { status: 404, body: { error: "Item not found" } };
    return { status: 200, body: { id, ...item } };
  }

  if (request.method === "POST") {
    const { name, price } = request.body || {};
    if (!name) return { status: 400, body: { error: "name required" } };
    const newId = Date.now().toString(36);
    context.log("Created:", newId, name);
    return {
      status: 201,
      headers: { "Location": \`/apis/items/\${newId}\` },
      body: { id: newId, name, price }
    };
  }

  return { status: 405, body: { error: "Method not allowed" } };
}`,
  },
  {
    label: "4. Fetch External API",
    key: "proxy",
    code: `// Route: GET /weather
export default async function handler(request, context) {
  const res = await fetch(
    "https://api.open-meteo.com/v1/forecast?latitude=21.03&longitude=105.85&current_weather=true"
  );
  const data = await res.json();

  context.log("Weather fetched:", data.current_weather?.temperature);

  return {
    status: 200,
    headers: { "Cache-Control": "public, max-age=300" },
    body: {
      city: "Hanoi",
      temperature: data.current_weather?.temperature,
      windspeed: data.current_weather?.windspeed,
      time: data.current_weather?.time
    }
  };
}`,
  },
  {
    label: "5. With lodash (isolated mode)",
    key: "lodash",
    code: `import _ from "lodash";

export default async function handler(request, context) {
  const items = request.body?.items || [
    { name: "Banana", category: "fruit", price: 1 },
    { name: "Apple", category: "fruit", price: 2 },
    { name: "Carrot", category: "vegetable", price: 1.5 },
    { name: "Broccoli", category: "vegetable", price: 3 }
  ];

  const sorted = _.sortBy(items, "name");
  const grouped = _.groupBy(sorted, "category");
  const avgPrice = _.meanBy(items, "price");

  context.log(\`Processed \${items.length} items, avg price: \${avgPrice}\`);

  return {
    status: 200,
    body: {
      total: items.length,
      avgPrice: _.round(avgPrice, 2),
      categories: _.mapValues(grouped, g => ({
        count: g.length,
        items: _.map(g, "name")
      }))
    }
  };
}`,
  },
  {
    label: "6. With dayjs + lodash",
    key: "dayjs-lodash",
    code: `import _ from "lodash";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default async function handler(request, context) {
  const events = [
    { name: "Launch", date: "2026-01-15" },
    { name: "Update v2", date: "2026-03-20" },
    { name: "Conference", date: "2026-06-10" },
    { name: "Hackathon", date: "2026-05-01" }
  ];

  const enriched = events.map(e => ({
    ...e,
    relative: dayjs(e.date).fromNow(),
    isPast: dayjs(e.date).isBefore(dayjs()),
    daysAway: dayjs(e.date).diff(dayjs(), "day")
  }));

  const upcoming = _.chain(enriched)
    .filter(e => !e.isPast)
    .sortBy("daysAway")
    .value();

  context.log(\`\${upcoming.length} upcoming events\`);

  return {
    status: 200,
    body: {
      now: dayjs().format("YYYY-MM-DD HH:mm"),
      total: events.length,
      upcoming,
      past: enriched.filter(e => e.isPast)
    }
  };
}`,
  },
];

// ── Constants ────────────────────────────────────────────────────────────────

const HANDLER_EDITOR_PATH = "handler-editor.js";

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

// ── Component ───────────────────────────────────────────────────────────────

interface HandlerCodeEditorProps {
  value: string;
  onChange: (code: string) => void;
  pendingCode?: string | null;
  onAcceptPending?: () => void;
  onRejectPending?: () => void;
}

// Track if providers are registered (global, not per-component)
let providersRegistered = false;

function registerProviders(monaco: Monaco) {
  if (providersRegistered) return;
  providersRegistered = true;

  // Disable built-in JS/TS completion + hover (the source of junk suggestions)
  // Keep only: syntax highlighting, bracket matching, diagnostics
  const jsDefaults = monaco.languages.typescript.javascriptDefaults;
  jsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
    // Filter out specific diagnostic codes we don't care about
    diagnosticCodesToIgnore: [
      // 80005: "'require' is not defined" etc
      80005,
      // 2307: Cannot find module (backup, in case wildcard doesn't catch all)
      2307,
    ],
  });
  jsDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    allowJs: true,
    checkJs: true,
    strict: false,
  });

  // Wildcard module declaration: makes all imports valid
  // This prevents "Cannot find module 'lodash'" errors
  jsDefaults.addExtraLib(`declare module "*";`, "wildcard-modules.d.ts");

  // Declare request/context globals for type checking (as fallback)
  jsDefaults.addExtraLib(
    `declare var request: {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: any;
};
declare var context: {
  log(...args: any[]): void;
};`,
    "handler-globals.d.ts",
  );

  // Disable TS-based completions and hovers (we use our own providers)
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

  const requestProps = [
    { label: "method", type: "string", doc: 'HTTP method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"' },
    { label: "path", type: "string", doc: "Request path, e.g. /users/123" },
    { label: "params", type: "Record<string, string>", doc: "Path parameters from route pattern (:id → params.id)" },
    { label: "query", type: "Record<string, string>", doc: "URL query parameters (?page=1&limit=10)" },
    { label: "headers", type: "Record<string, string>", doc: "HTTP request headers" },
    { label: "body", type: "any | null", doc: "Parsed request body (JSON) or null for GET" },
  ];

  const contextProps = [{ label: "log", type: "(...args: any[]) => void", doc: "Log to execution logs (Logs tab)", snippet: "log(${1})" }];

  // ── CompletionItemProvider ──────────────────────────────────────────────
  monaco.languages.registerCompletionItemProvider("javascript", {
    triggerCharacters: ["."],
    provideCompletionItems: (model: ITextModel, position: IPosition) => {
      if (!model.uri.path.includes("handler-editor")) return { suggestions: [] };
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

      // request.
      if (/\brequest\.\w*$/.test(line)) {
        return {
          suggestions: requestProps.map((p, i) => ({
            label: p.label,
            kind: CompletionItemKind.Property,
            detail: `(property) ${p.type}`,
            documentation: p.doc,
            insertText: p.label,
            sortText: `!${String(i).padStart(2, "0")}`,
            preselect: i === 0,
            range,
          })),
        };
      }

      // context.
      if (/\bcontext\.\w*$/.test(line)) {
        return {
          suggestions: contextProps.map((p, i) => ({
            label: p.label,
            kind: CompletionItemKind.Method,
            detail: `(method) ${p.type}`,
            documentation: p.doc,
            insertText: p.snippet || p.label,
            insertTextRules: p.snippet ? CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            sortText: `!${String(i).padStart(2, "0")}`,
            preselect: i === 0,
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
      if (!model.uri.path.includes("handler-editor")) return null;
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

      if (word.word === "request" && !before.endsWith(".")) {
        return {
          range,
          contents: [
            { value: "```typescript\n(parameter) request: HandlerRequest\n```" },
            {
              value:
                "```typescript\ninterface HandlerRequest {\n  method: string;\n  path: string;\n  params: Record<string, string>;\n  query: Record<string, string>;\n  headers: Record<string, string>;\n  body: any;\n}\n```",
            },
          ],
        };
      }

      if (word.word === "context" && !before.endsWith(".")) {
        return {
          range,
          contents: [
            { value: "```typescript\n(parameter) context: HandlerContext\n```" },
            { value: "```typescript\ninterface HandlerContext {\n  log(...args: any[]): void;\n}\n```" },
          ],
        };
      }

      if (word.word === "handler" && !before.endsWith(".")) {
        return {
          range,
          contents: [
            { value: "```typescript\nasync function handler(\n  request: HandlerRequest,\n  context: HandlerContext\n): Promise<HandlerResponse>\n```" },
            { value: "```typescript\ninterface HandlerResponse {\n  status: number;\n  headers?: Record<string, string>;\n  body?: any;\n}\n```" },
          ],
        };
      }

      // request.xxx hover
      if (before.trimEnd().endsWith("request.")) {
        const prop = requestProps.find((p) => p.label === word.word);
        if (prop) {
          return {
            range,
            contents: [{ value: `\`\`\`typescript\n(property) ${prop.label}: ${prop.type}\n\`\`\`` }, { value: prop.doc }],
          };
        }
      }

      // context.xxx hover
      if (before.trimEnd().endsWith("context.") && word.word === "log") {
        return {
          range,
          contents: [{ value: "```typescript\n(method) log(...args: any[]): void\n```" }, { value: "Log to execution logs. Viewable in the **Logs** tab." }],
        };
      }

      return null;
    },
  });
}

export function HandlerCodeEditor({ value, onChange, pendingCode, onAcceptPending, onRejectPending }: HandlerCodeEditorProps) {
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
          <label className="font-mono text-[10px] text-muted-soft uppercase tracking-wider">Handler Code (JavaScript)</label>
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
              path={HANDLER_EDITOR_PATH}
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
