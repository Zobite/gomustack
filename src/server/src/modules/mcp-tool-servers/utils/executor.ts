/**
 * MCP Tool JavaScript Executor
 *
 * Executes custom MCP tool code in an isolated Bun subprocess.
 * Tool code follows the pattern:
 *
 * ```javascript
 * export default async function execute(params, context) {
 *   // params: input from AI agent (matches input schema)
 *   // context: { log, http, kv, tables }
 *   return { result: "Hello!" };
 * }
 * ```
 *
 * Reuses the same sandbox infrastructure as Dynamic APIs
 * (auto-detects npm imports, per-tool node_modules caching).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDependencies, parseNpmImports } from "../../../common/sandbox/js-executor.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface McpToolResult {
  success: boolean;
  result: unknown;
  executionTimeMs: number;
  stdout: string;
  stderr: string;
}

export interface McpToolExecOptions {
  timeoutMs?: number; // default 30_000
  baseUrl?: string; // internal API base URL for context SDK
  authToken?: string; // JWT for context SDK
}

// ── Sandbox directory ───────────────────────────────────────────────────────

function getSandboxDir(toolId: string): string {
  const dataDir = process.env.DATA_DIR ?? `${process.env.HOME}/.gomustack`;
  return join(dataDir, "mcp-tool-sandboxes", toolId);
}

/**
 * Ensure sandbox directory exists with node_modules installed.
 * Only re-installs when dependencies change.
 */
async function ensureSandbox(toolId: string, dependencies: Record<string, string>): Promise<string> {
  const sandboxDir = getSandboxDir(toolId);
  mkdirSync(sandboxDir, { recursive: true });

  // Check if deps changed
  const depsFile = join(sandboxDir, "deps.json");
  const sortedKeys = Object.keys(dependencies).sort();
  const newDepsStr = JSON.stringify(dependencies, sortedKeys);
  let needsInstall = Object.keys(dependencies).length > 0;

  if (existsSync(depsFile)) {
    const existing = readFileSync(depsFile, "utf-8").trim();
    if (existing === newDepsStr) {
      needsInstall = false;
    }
  } else if (Object.keys(dependencies).length === 0) {
    needsInstall = false;
  }

  if (needsInstall) {
    const pkg = {
      name: `mcp-tool-sandbox-${toolId}`,
      version: "1.0.0",
      private: true,
      dependencies,
    };
    writeFileSync(join(sandboxDir, "package.json"), JSON.stringify(pkg, null, 2));

    const proc = Bun.spawn(["bun", "install", "--no-frozen-lockfile"], {
      cwd: sandboxDir,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Failed to install dependencies: ${stderr}`);
    }

    writeFileSync(depsFile, newDepsStr);
  }

  writeFileSync(join(sandboxDir, "last_used.txt"), String(Date.now()));
  return sandboxDir;
}

// ── Runner script ───────────────────────────────────────────────────────────

function generateRunner(baseUrl: string, authToken: string): string {
  return `
// Runner script — executed by Bun subprocess for MCP tool
const path = require("path");

(async () => {
  const consoleLogs = [];
  const originalLog = console.log;

  // Read input from stdin
  let inputData = "";
  for await (const chunk of Bun.stdin.stream()) {
    inputData += new TextDecoder().decode(chunk);
  }

  const { params } = JSON.parse(inputData);

  // ── Context SDK ──────────────────────────────────────────────────────────
  const BASE_URL = ${JSON.stringify(baseUrl)};
  const AUTH_TOKEN = ${JSON.stringify(authToken)};

  const httpHelper = {
    _request: async (method, url, data, headers) => {
      const isExternal = url.startsWith("http");
      const fullUrl = isExternal ? url : BASE_URL + url;
      const defaultHeaders = isExternal
        ? { ...(headers || {}) }
        : {
            Authorization: "Bearer " + AUTH_TOKEN,
            "Content-Type": "application/json",
            ...(headers || {}),
          };
      const opts = { method, headers: defaultHeaders };
      if (data) opts.body = JSON.stringify(data);
      try {
        const res = await fetch(fullUrl, opts);
        if (isExternal) {
          // External URLs: return raw text so tool code can JSON.parse() if needed
          return await res.text();
        }
        return await res.json();
      } catch (e) {
        return { error: e.message };
      }
    },
    get: (url, headers) => httpHelper._request("GET", url, null, headers),
    post: (url, data, headers) => httpHelper._request("POST", url, data, headers),
    patch: (url, data, headers) => httpHelper._request("PATCH", url, data, headers),
    delete: (url, headers) => httpHelper._request("DELETE", url, null, headers),
  };

  const context = {
    log: (...args) => {
      const line = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
      consoleLogs.push(line);
    },
    http: httpHelper,
    kv: {
      get: async (key) => {
        const res = await httpHelper.get("/api/kv-store/by-key/" + encodeURIComponent(key));
        if (!res || res.error) return null;
        const raw = res.value;
        if (raw === undefined || raw === null) return null;
        try { return JSON.parse(raw); } catch { return raw; }
      },
      set: (key, value, ttl) => httpHelper.post("/api/kv-store", { key, value: typeof value === "string" ? value : JSON.stringify(value), ttl: ttl || 0 }),
    },
    tables: {
      query: (projectId, tableId, filters, page, limit) => {
        let qs = "page=" + (page || 1) + "&limit=" + (limit || 50);
        if (filters) qs += "&filter=" + JSON.stringify(filters);
        return httpHelper.get("/api/datatables/" + projectId + "/tables/" + tableId + "/rows?" + qs);
      },
      insert: (projectId, tableId, data) =>
        httpHelper.post("/api/datatables/" + projectId + "/tables/" + tableId + "/rows", { data }),
    },
  };

  try {
    const toolModule = await import(path.join(process.cwd(), "tool.mjs"));
    const execute = toolModule.default || toolModule.execute || toolModule;

    if (typeof execute !== "function") {
      throw new Error(
        "No execute function found. export default async function execute(params, context) { ... }"
      );
    }

    const result = await execute(params, context);

    const output = {
      success: true,
      result: result ?? null,
      consoleLogs,
    };

    originalLog("__RESULT_START__");
    originalLog(JSON.stringify(output));
    originalLog("__RESULT_END__");
  } catch (err) {
    const output = {
      success: false,
      result: { error: "execution_error", message: err.message },
      consoleLogs,
      error: err.stack || err.message,
    };
    originalLog("__RESULT_START__");
    originalLog(JSON.stringify(output));
    originalLog("__RESULT_END__");
    process.exit(1);
  }
})();
`;
}

/**
 * Convert user code to an ES module format.
 */
function toModuleCode(code: string): string {
  if (/export\s+default/.test(code)) {
    return code;
  }
  if (/async\s+function\s+execute/.test(code)) {
    return `${code}\nexport default execute;\n`;
  }
  if (/function\s+execute/.test(code)) {
    return `${code}\nexport default execute;\n`;
  }
  return `${code}\nexport default typeof execute !== 'undefined' ? execute : undefined;\n`;
}

// ── Execute ─────────────────────────────────────────────────────────────────

/**
 * Execute MCP tool JavaScript code in a sandboxed Bun subprocess.
 */
export async function executeMcpToolJs(
  toolId: string,
  code: string,
  params: Record<string, unknown>,
  options: McpToolExecOptions = {},
): Promise<McpToolResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:5610";
  const authToken = options.authToken ?? "";
  const startTime = Date.now();

  try {
    // 1. Auto-detect npm packages from code
    const detected = parseNpmImports(code);
    const dependencies = buildDependencies(detected);

    // 2. Ensure sandbox with deps
    const sandboxDir = await ensureSandbox(toolId, dependencies);

    // 3. Write tool code
    const toolCode = toModuleCode(code);
    writeFileSync(join(sandboxDir, "tool.mjs"), toolCode);

    // 4. Write runner
    writeFileSync(join(sandboxDir, "runner.js"), generateRunner(baseUrl, authToken));

    // 5. Prepare input data
    const inputData = JSON.stringify({ params });

    // 6. Spawn Bun subprocess
    const proc = Bun.spawn(["bun", "run", "runner.js"], {
      cwd: sandboxDir,
      stdout: "pipe",
      stderr: "pipe",
      stdin: new Blob([inputData]),
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "development" },
    });

    // 7. Handle timeout
    const timeoutPromise = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs));

    const exitPromise = proc.exited.then(() => "done" as const);
    const race = await Promise.race([exitPromise, timeoutPromise]);

    if (race === "timeout") {
      proc.kill();
      return {
        success: false,
        result: { error: "timeout", message: `Execution timed out after ${timeoutMs}ms` },
        executionTimeMs: Date.now() - startTime,
        stdout: "",
        stderr: "",
      };
    }

    // 8. Read output
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const executionTimeMs = Date.now() - startTime;

    // 9. Parse result
    const resultMatch = stdout.match(/__RESULT_START__\n([\s\S]*?)\n__RESULT_END__/);

    if (resultMatch) {
      try {
        const parsed = JSON.parse(resultMatch[1]);
        return {
          success: parsed.success ?? true,
          result: parsed.result ?? null,
          executionTimeMs,
          stdout: parsed.consoleLogs?.join("\n") ?? "",
          stderr,
        };
      } catch {
        return {
          success: false,
          result: { error: "parse_error", message: "Failed to parse tool result" },
          executionTimeMs,
          stdout: stdout.trim(),
          stderr,
        };
      }
    }

    return {
      success: false,
      result: {
        error: "execution_error",
        message: stderr.trim() || "Tool did not produce output",
      },
      executionTimeMs,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (err) {
    return {
      success: false,
      result: {
        error: "sandbox_error",
        message: err instanceof Error ? err.message : "Sandbox setup failed",
      },
      executionTimeMs: Date.now() - startTime,
      stdout: "",
      stderr: "",
    };
  }
}

/**
 * Execute MCP tool in-process (fast mode, no npm imports).
 */
export async function executeMcpToolFast(code: string, params: Record<string, unknown>, options: McpToolExecOptions = {}): Promise<McpToolResult> {
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:5610";
  const authToken = options.authToken ?? "";
  const startTime = Date.now();
  const consoleLogs: string[] = [];

  const context = {
    log: (...args: unknown[]) => {
      consoleLogs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    },
    http: {
      _request: async (method: string, url: string, data?: unknown, headers?: Record<string, string>) => {
        const isExternal = url.startsWith("http");
        const fullUrl = isExternal ? url : `${baseUrl}${url}`;
        const defaultHeaders: Record<string, string> = isExternal
          ? { ...(headers || {}) }
          : {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
              ...(headers || {}),
            };
        const opts: RequestInit = { method, headers: defaultHeaders };
        if (data) opts.body = JSON.stringify(data);
        try {
          const res = await fetch(fullUrl, opts);
          if (isExternal) {
            // External URLs: return raw text so tool code can JSON.parse() if needed
            return await res.text();
          }
          return await res.json();
        } catch (e) {
          return { error: (e as Error).message };
        }
      },
      get: (url: string, headers?: Record<string, string>) => context.http._request("GET", url, undefined, headers),
      post: (url: string, data?: unknown, headers?: Record<string, string>) => context.http._request("POST", url, data, headers),
      patch: (url: string, data?: unknown, headers?: Record<string, string>) => context.http._request("PATCH", url, data, headers),
      delete: (url: string, headers?: Record<string, string>) => context.http._request("DELETE", url, undefined, headers),
    },
    kv: {
      get: async (key: string) => {
        const res = (await context.http.get(`/api/kv-store/by-key/${encodeURIComponent(key)}`)) as Record<string, unknown> | null;
        if (!res || res.error) return null;
        const raw = res.value as string | undefined;
        if (raw === undefined || raw === null) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      },
      set: (key: string, value: unknown, ttl?: number) =>
        context.http.post("/api/kv-store", { key, value: typeof value === "string" ? value : JSON.stringify(value), ttl: ttl || 0 }),
    },
    tables: {
      query: (projectId: string, tableId: string, filters?: unknown, page = 1, limit = 50) => {
        let qs = `page=${page}&limit=${limit}`;
        if (filters) qs += `&filter=${JSON.stringify(filters)}`;
        return context.http.get(`/api/datatables/${projectId}/tables/${tableId}/rows?${qs}`);
      },
      insert: (projectId: string, tableId: string, data: unknown) => context.http.post(`/api/datatables/${projectId}/tables/${tableId}/rows`, { data }),
    },
  };

  try {
    const cleanCode = code.replace(/export\s+default\s+/g, "").replace(/module\.exports\s*=\s*/g, "");

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const factory = new AsyncFunction(
      `${cleanCode}
       if (typeof execute === 'function') return execute;
       throw new Error('No execute function found.');`,
    );

    const execute = await factory();
    const result = await Promise.race([
      execute(params, context),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Execution timeout")), options.timeoutMs ?? 30_000)),
    ]);

    return {
      success: true,
      result: result ?? null,
      executionTimeMs: Date.now() - startTime,
      stdout: consoleLogs.join("\n"),
      stderr: "",
    };
  } catch (err) {
    return {
      success: false,
      result: {
        error: "execution_error",
        message: (err as Error).message,
      },
      executionTimeMs: Date.now() - startTime,
      stdout: consoleLogs.join("\n"),
      stderr: (err as Error).stack || (err as Error).message,
    };
  }
}

/**
 * Execute MCP tool — auto-selects fast vs isolated mode.
 */
export async function executeMcpTool(toolId: string, code: string, params: Record<string, unknown>, options: McpToolExecOptions = {}): Promise<McpToolResult> {
  const hasImports = parseNpmImports(code).length > 0;

  if (hasImports) {
    return executeMcpToolJs(toolId, code, params, options);
  }

  return executeMcpToolFast(code, params, options);
}
