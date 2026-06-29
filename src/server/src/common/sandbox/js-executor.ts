/**
 * JavaScript Isolated Sandbox Executor
 *
 * Executes Dynamic API handler code in a Bun subprocess with per-endpoint
 * node_modules. Auto-detects npm dependencies from import/require statements.
 *
 * Flow:
 * 1. Parse imports from handler code → detect npm packages
 * 2. Find or create sandbox dir at DATA_DIR/api-sandboxes/<apiId>/
 * 3. Install npm dependencies if changed (bun install)
 * 4. Write handler + runner script
 * 5. Spawn `bun run runner.js` in sandbox
 * 6. Parse JSON result from stdout
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

// ── Node/Bun built-in modules ───────────────────────────────────────────────

const NODE_BUILTINS = new Set([
  "assert", "async_hooks", "buffer", "child_process", "cluster", "console",
  "constants", "crypto", "dgram", "diagnostics_channel", "dns", "domain",
  "events", "fs", "http", "http2", "https", "inspector", "module", "net",
  "os", "path", "perf_hooks", "process", "punycode", "querystring",
  "readline", "repl", "stream", "string_decoder", "sys", "timers",
  "tls", "trace_events", "tty", "url", "util", "v8", "vm", "wasi",
  "worker_threads", "zlib",
  // Bun built-ins
  "bun", "bun:test", "bun:sqlite", "bun:ffi", "bun:jsc",
]);

function isBuiltinModule(name: string): boolean {
  if (NODE_BUILTINS.has(name)) return true;
  if (name.startsWith("node:")) return true;
  if (name.startsWith("bun:")) return true;
  return false;
}

// ── Import Parser ───────────────────────────────────────────────────────────

/**
 * Extract npm package name from an import specifier.
 *
 * "lodash"           → "lodash"
 * "lodash/sortBy"    → "lodash"
 * "@aws-sdk/client-s3" → "@aws-sdk/client-s3"
 * "@scope/pkg/sub"   → "@scope/pkg"
 * "./local"          → null (relative)
 * "../utils"         → null (relative)
 */
function extractPackageName(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return specifier.split("/")[0];
}

/**
 * Parse import/require statements from JS/TS code and extract npm package names.
 * Returns array of detected npm package names (not built-ins, not relative).
 */
export function parseNpmImports(code: string): string[] {
  const packages = new Set<string>();
  const lines = code.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }

    // ESM: import ... from "package"
    // import _ from "lodash"
    // import { sortBy } from "lodash"
    // import dayjs from "dayjs"
    // import * as R from "ramda"
    // import "side-effects-pkg"
    const esmMatch = trimmed.match(
      /import\s+(?:[\w${},*\s]+\s+from\s+)?["']([^"']+)["']/
    );
    if (esmMatch) {
      const pkg = extractPackageName(esmMatch[1]);
      if (pkg && !isBuiltinModule(pkg)) {
        packages.add(pkg);
      }
      continue;
    }

    // CJS: const x = require("package")
    const cjsMatch = trimmed.match(/require\s*\(\s*["']([^"']+)["']\s*\)/);
    if (cjsMatch) {
      const pkg = extractPackageName(cjsMatch[1]);
      if (pkg && !isBuiltinModule(pkg)) {
        packages.add(pkg);
      }
    }

    // Dynamic import: await import("package")
    const dynamicMatch = trimmed.match(/import\s*\(\s*["']([^"']+)["']\s*\)/);
    if (dynamicMatch) {
      const pkg = extractPackageName(dynamicMatch[1]);
      if (pkg && !isBuiltinModule(pkg)) {
        packages.add(pkg);
      }
    }
  }

  return Array.from(packages);
}

/**
 * Check if code has any npm imports (fast check, no allocation).
 */
export function hasNpmImports(code: string): boolean {
  return parseNpmImports(code).length > 0;
}

/**
 * Convert detected packages to a dependencies record (all "latest").
 * If explicit deps provided, merge them (explicit versions take priority).
 */
export function buildDependencies(
  detectedPackages: string[],
  explicitDeps?: Record<string, string> | null
): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const pkg of detectedPackages) {
    deps[pkg] = explicitDeps?.[pkg] ?? "latest";
  }
  return deps;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface IsolatedResult {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
  consoleLogs: string[];
  executionTimeMs: number;
  error?: string;
}

export interface IsolatedRunOptions {
  apiId: string;
  code: string;
  /** Explicit deps from DB (optional). Auto-detected imports are merged. */
  explicitDeps?: Record<string, string> | null;
  request: {
    method: string;
    path: string;
    params: Record<string, string>;
    query: Record<string, string>;
    headers: Record<string, string>;
    body: unknown;
  };
  timeoutMs: number;
}

// ── Implementation ──────────────────────────────────────────────────────────

function getSandboxDir(apiId: string): string {
  const dataDir =
    process.env.DATA_DIR ?? `${process.env.HOME}/.gomustack`;
  return join(dataDir, "api-sandboxes", apiId);
}

/**
 * Ensure sandbox directory exists with node_modules installed.
 * Only re-installs when dependencies change.
 */
async function ensureSandbox(
  apiId: string,
  dependencies: Record<string, string>
): Promise<string> {
  const sandboxDir = getSandboxDir(apiId);
  mkdirSync(sandboxDir, { recursive: true });

  // Check if deps changed
  const depsFile = join(sandboxDir, "deps.json");
  const sortedKeys = Object.keys(dependencies).sort();
  const newDepsStr = JSON.stringify(dependencies, sortedKeys);
  let needsInstall = true;

  if (existsSync(depsFile)) {
    const existing = readFileSync(depsFile, "utf-8").trim();
    if (existing === newDepsStr) {
      needsInstall = false;
    }
  }

  if (needsInstall) {
    // Write package.json
    const pkg = {
      name: `api-sandbox-${apiId}`,
      version: "1.0.0",
      private: true,
      dependencies,
    };
    writeFileSync(join(sandboxDir, "package.json"), JSON.stringify(pkg, null, 2));

    // Run bun install
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

    // Save deps hash
    writeFileSync(depsFile, newDepsStr);
  }

  // Update last_used
  writeFileSync(join(sandboxDir, "last_used.txt"), String(Date.now()));

  return sandboxDir;
}

/**
 * Generate the runner script.
 */
function generateRunner(): string {
  return `
// Runner script — executed by Bun subprocess
const path = require("path");

(async () => {
  const consoleLogs = [];
  const originalLog = console.log;

  // Read input from stdin
  let inputData = "";
  for await (const chunk of Bun.stdin.stream()) {
    inputData += new TextDecoder().decode(chunk);
  }

  const { request } = JSON.parse(inputData);

  const context = {
    log: (...args) => {
      const line = args
        .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
        .join(" ");
      consoleLogs.push(line);
    },
  };

  try {
    // Import the handler module
    const handlerModule = await import(path.join(process.cwd(), "handler.mjs"));
    const handler = handlerModule.default || handlerModule.handler || handlerModule;

    if (typeof handler !== "function") {
      throw new Error(
        "No handler function found. export default async function handler(request, context) { ... }"
      );
    }

    const result = await handler(request, context);

    const output = {
      status: result?.status ?? 200,
      headers: result?.headers ?? undefined,
      body: result?.body ?? null,
      consoleLogs,
    };

    originalLog("__RESULT_START__");
    originalLog(JSON.stringify(output));
    originalLog("__RESULT_END__");
  } catch (err) {
    const output = {
      status: 500,
      body: { error: "execution_error", message: err.message },
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
  if (/async\s+function\s+handler/.test(code)) {
    return `${code}\nexport default handler;\n`;
  }
  return `${code}\nexport default typeof handler !== 'undefined' ? handler : undefined;\n`;
}

/**
 * Execute a Dynamic API handler in isolated Bun subprocess.
 * Auto-detects npm imports from code and installs them.
 */
export async function executeIsolated(
  options: IsolatedRunOptions
): Promise<IsolatedResult> {
  const startTime = Date.now();

  try {
    // 1. Auto-detect npm packages from code
    const detected = parseNpmImports(options.code);
    const dependencies = buildDependencies(detected, options.explicitDeps);

    // 2. Ensure sandbox with deps
    const sandboxDir = await ensureSandbox(options.apiId, dependencies);

    // 3. Write handler code
    const handlerCode = toModuleCode(options.code);
    writeFileSync(join(sandboxDir, "handler.mjs"), handlerCode);

    // 4. Write runner
    writeFileSync(join(sandboxDir, "runner.js"), generateRunner());

    // 5. Prepare input data
    const inputData = JSON.stringify({ request: options.request });

    // 6. Spawn Bun subprocess
    const proc = Bun.spawn(["bun", "run", "runner.js"], {
      cwd: sandboxDir,
      stdout: "pipe",
      stderr: "pipe",
      stdin: new Blob([inputData]),
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "development" },
    });

    // 7. Handle timeout
    const timeoutPromise = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), options.timeoutMs)
    );

    const exitPromise = proc.exited.then(() => "done" as const);
    const race = await Promise.race([exitPromise, timeoutPromise]);

    if (race === "timeout") {
      proc.kill();
      return {
        status: 504,
        body: { error: "timeout", message: "Execution timeout" },
        consoleLogs: [],
        executionTimeMs: Date.now() - startTime,
        error: "Execution timeout",
      };
    }

    // 8. Read output
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const executionTimeMs = Date.now() - startTime;

    // 9. Parse result
    const resultMatch = stdout.match(
      /__RESULT_START__\n([\s\S]*?)\n__RESULT_END__/
    );

    if (resultMatch) {
      try {
        const parsed = JSON.parse(resultMatch[1]);
        return {
          status: parsed.status ?? 200,
          headers: parsed.headers,
          body: parsed.body ?? null,
          consoleLogs: parsed.consoleLogs ?? [],
          executionTimeMs,
          error: parsed.error,
        };
      } catch {
        return {
          status: 500,
          body: { error: "parse_error", message: "Failed to parse handler result" },
          consoleLogs: [],
          executionTimeMs,
          error: stderr || "Failed to parse output",
        };
      }
    }

    return {
      status: 500,
      body: {
        error: "execution_error",
        message:
          process.env.NODE_ENV === "production"
            ? "Internal handler error"
            : stderr.trim() || "Handler did not produce output",
      },
      consoleLogs: [],
      executionTimeMs,
      error: stderr.trim() || "No result produced",
    };
  } catch (err) {
    return {
      status: 500,
      body: {
        error: "sandbox_error",
        message:
          err instanceof Error ? err.message : "Sandbox setup failed",
      },
      consoleLogs: [],
      executionTimeMs: Date.now() - startTime,
      error: err instanceof Error ? err.stack || err.message : "Unknown error",
    };
  }
}

/**
 * Remove sandbox directory for a specific API endpoint.
 */
export function removeSandbox(apiId: string): void {
  const sandboxDir = getSandboxDir(apiId);
  if (existsSync(sandboxDir)) {
    rmSync(sandboxDir, { recursive: true, force: true });
  }
}

/**
 * Invalidate sandbox deps cache (forces reinstall on next execution).
 */
export function invalidateSandboxDeps(apiId: string): void {
  const sandboxDir = getSandboxDir(apiId);
  const depsFile = join(sandboxDir, "deps.json");
  if (existsSync(depsFile)) {
    rmSync(depsFile);
  }
}

/**
 * Clean up sandboxes not used for more than maxAgeDays.
 */
export function cleanupStaleSandboxes(maxAgeDays = 7): number {
  const dataDir =
    process.env.DATA_DIR ?? `${process.env.HOME}/.gomustack`;
  const baseDir = join(dataDir, "api-sandboxes");
  if (!existsSync(baseDir)) return 0;

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now();
  let cleaned = 0;

  const entries = readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(baseDir, entry.name);
    const lastUsedFile = join(dir, "last_used.txt");

    let lastUsed = 0;
    if (existsSync(lastUsedFile)) {
      lastUsed =
        parseInt(readFileSync(lastUsedFile, "utf-8").trim(), 10) || 0;
    } else {
      lastUsed = statSync(dir).mtimeMs;
    }

    if (cutoff - lastUsed > maxAgeMs) {
      rmSync(dir, { recursive: true, force: true });
      cleaned++;
    }
  }

  return cleaned;
}
