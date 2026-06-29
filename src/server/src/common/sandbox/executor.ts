/**
 * Python Sandbox Executor
 *
 * Executes tool Python code in an isolated subprocess with per-tool venv caching.
 *
 * Flow:
 * 1. Find or create venv for toolId at DATA_DIR/tool-venvs/<toolId>/
 * 2. Detect import deps from code, install if new
 * 3. Write wrapper script that injects params + captures result
 * 4. Spawn `python wrapper.py` inside venv
 * 5. Parse JSON result from stdout
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

// ── Python stdlib modules (do not pip install) ─────────────────────────────

const PYTHON_STDLIB = new Set([
  "abc", "aifc", "argparse", "array", "ast", "asynchat", "asyncio", "asyncore",
  "atexit", "audioop", "base64", "bdb", "binascii", "binhex", "bisect",
  "builtins", "bz2", "calendar", "cgi", "cgitb", "chunk", "cmath", "cmd",
  "code", "codecs", "codeop", "collections", "colorsys", "compileall",
  "concurrent", "configparser", "contextlib", "contextvars", "copy", "copyreg",
  "cProfile", "crypt", "csv", "ctypes", "curses", "dataclasses", "datetime",
  "dbm", "decimal", "difflib", "dis", "distutils", "doctest", "email",
  "encodings", "enum", "errno", "faulthandler", "fcntl", "filecmp", "fileinput",
  "fnmatch", "formatter", "fractions", "ftplib", "functools", "gc", "getopt",
  "getpass", "gettext", "glob", "grp", "gzip", "hashlib", "heapq", "hmac",
  "html", "http", "idlelib", "imaplib", "imghdr", "imp", "importlib", "inspect",
  "io", "ipaddress", "itertools", "json", "keyword", "lib2to3", "linecache",
  "locale", "logging", "lzma", "mailbox", "mailcap", "marshal", "math",
  "mimetypes", "mmap", "modulefinder", "multiprocessing", "netrc", "nis",
  "nntplib", "numbers", "operator", "optparse", "os", "ossaudiodev",
  "parser", "pathlib", "pdb", "pickle", "pickletools", "pipes", "pkgutil",
  "platform", "plistlib", "poplib", "posix", "posixpath", "pprint",
  "profile", "pstats", "pty", "pwd", "py_compile", "pyclbr", "pydoc",
  "queue", "quopri", "random", "re", "readline", "reprlib", "resource",
  "rlcompleter", "runpy", "sched", "secrets", "select", "selectors", "shelve",
  "shlex", "shutil", "signal", "site", "smtpd", "smtplib", "sndhdr",
  "socket", "socketserver", "sqlite3", "ssl", "stat", "statistics", "string",
  "stringprep", "struct", "subprocess", "sunau", "symtable", "sys", "sysconfig",
  "syslog", "tabnanny", "tarfile", "telnetlib", "tempfile", "termios", "test",
  "textwrap", "threading", "time", "timeit", "tkinter", "token", "tokenize",
  "trace", "traceback", "tracemalloc", "tty", "turtle", "turtledemo",
  "types", "typing", "unicodedata", "unittest", "urllib", "uu", "uuid",
  "venv", "warnings", "wave", "weakref", "webbrowser", "winreg", "winsound",
  "wsgiref", "xdrlib", "xml", "xmlrpc", "zipapp", "zipfile", "zipimport",
  "zlib", "_thread", "__future__",
]);

// ── Common import-to-pip name mapping ─────────────────────────────────────

const IMPORT_TO_PIP: Record<string, string> = {
  cv2: "opencv-python",
  PIL: "Pillow",
  sklearn: "scikit-learn",
  skimage: "scikit-image",
  yaml: "pyyaml",
  bs4: "beautifulsoup4",
  dotenv: "python-dotenv",
  attr: "attrs",
  gi: "PyGObject",
  Crypto: "pycryptodome",
  serial: "pyserial",
  usb: "pyusb",
  wx: "wxPython",
  dns: "dnspython",
  lxml: "lxml",
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface SandboxResult {
  success: boolean;
  result: unknown;
  executionTimeMs: number;
  stdout: string;
  stderr: string;
}

export interface SandboxOptions {
  timeoutMs?: number;   // default 30_000
  baseUrl?: string;     // internal API base URL for context SDK
  authToken?: string;   // JWT for context SDK
}

// ── Implementation ──────────────────────────────────────────────────────────

function getVenvDir(toolId: string): string {
  const dataDir = process.env.DATA_DIR ?? `${process.env.HOME}/.gomustack`;
  return join(dataDir, "tool-venvs", toolId);
}

function getPythonPath(venvDir: string): string {
  return join(venvDir, "venv", "bin", "python");
}

function getPipPath(venvDir: string): string {
  return join(venvDir, "venv", "bin", "pip");
}

/**
 * Extract import names from Python source code.
 * Returns top-level module names only (e.g. "requests" from "from requests.auth import ...")
 */
function extractImports(code: string): string[] {
  const imports = new Set<string>();
  const lines = code.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // import X, Y, Z
    const importMatch = trimmed.match(/^import\s+(.+)/);
    if (importMatch) {
      const parts = importMatch[1].split(",");
      for (const part of parts) {
        const name = part.trim().split(/\s+as\s+/)[0].split(".")[0].trim();
        if (name && !name.startsWith("#")) imports.add(name);
      }
      continue;
    }

    // from X import Y
    const fromMatch = trimmed.match(/^from\s+(\S+)\s+import/);
    if (fromMatch) {
      const name = fromMatch[1].split(".")[0].trim();
      if (name && !name.startsWith(".")) imports.add(name);
    }
  }

  return Array.from(imports);
}

/**
 * Filter imports to only external packages (not stdlib, not local).
 * Map import names to pip package names where needed.
 */
function resolvePackages(imports: string[]): string[] {
  const packages: string[] = [];

  for (const imp of imports) {
    if (PYTHON_STDLIB.has(imp)) continue;
    if (imp === "context_sdk") continue; // our injected module
    const pipName = IMPORT_TO_PIP[imp] ?? imp;
    packages.push(pipName);
  }

  return [...new Set(packages)];
}

/**
 * Ensure venv exists for the tool. Create if missing.
 */
async function ensureVenv(toolId: string): Promise<string> {
  const venvDir = getVenvDir(toolId);
  const pythonPath = getPythonPath(venvDir);

  if (existsSync(pythonPath)) {
    // Update last_used timestamp
    writeFileSync(join(venvDir, "last_used.txt"), String(Date.now()));
    return venvDir;
  }

  // Create directory
  mkdirSync(venvDir, { recursive: true });

  // Create venv
  const proc = Bun.spawn(["python3", "-m", "venv", join(venvDir, "venv")], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to create venv: ${stderr}`);
  }

  writeFileSync(join(venvDir, "last_used.txt"), String(Date.now()));
  return venvDir;
}

/**
 * Install packages into venv if they differ from cached requirements.
 */
async function installDependencies(venvDir: string, packages: string[]): Promise<void> {
  if (packages.length === 0) return;

  const reqFile = join(venvDir, "requirements.txt");
  const newReqs = packages.sort().join("\n");

  // Check if requirements changed
  if (existsSync(reqFile)) {
    const existing = readFileSync(reqFile, "utf-8").trim();
    if (existing === newReqs) return; // no changes
  }

  // Install
  const pipPath = getPipPath(venvDir);
  const proc = Bun.spawn([pipPath, "install", ...packages, "--quiet", "--disable-pip-version-check"], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, VIRTUAL_ENV: join(venvDir, "venv") },
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to install dependencies: ${stderr}`);
  }

  // Save requirements for next time
  writeFileSync(reqFile, newReqs);
}

/**
 * Generate Python wrapper script that:
 * 1. Injects params as JSON
 * 2. Provides a minimal context object
 * 3. Calls execute(params, context)
 * 4. Prints result as JSON to stdout
 */
function generateWrapper(
  code: string,
  params: Record<string, unknown>,
  options: SandboxOptions,
): string {
  const paramsJson = JSON.stringify(params);
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:5610";
  const authToken = options.authToken ?? "";

  return `
import sys
import json
import traceback

# ── Context SDK ──────────────────────────────────────────────────────────
class _HttpHelper:
    def __init__(self, base_url, token):
        self._base_url = base_url
        self._token = token
        self._headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def _request(self, method, url, data=None, headers=None):
        import urllib.request
        import urllib.error
        full_url = url if url.startswith("http") else f"{self._base_url}{url}"
        hdrs = {**self._headers, **(headers or {})}
        body = json.dumps(data).encode() if data else None
        req = urllib.request.Request(full_url, data=body, headers=hdrs, method=method)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            return {"error": e.code, "message": e.read().decode()}

    def get(self, url, headers=None):
        return self._request("GET", url, headers=headers)

    def post(self, url, data=None, headers=None):
        return self._request("POST", url, data=data, headers=headers)

    def patch(self, url, data=None, headers=None):
        return self._request("PATCH", url, data=data, headers=headers)

    def delete(self, url, headers=None):
        return self._request("DELETE", url, headers=headers)


class _VariablesHelper:
    def __init__(self, http):
        self._http = http

    def get(self, key):
        return self._http.get(f"/api/kv-store/by-key/{key}")

    def set(self, key, value, ttl=0):
        return self._http.post("/api/kv-store", {
            "key": key, "value": str(value), "ttl": ttl
        })


class _TablesHelper:
    def __init__(self, http):
        self._http = http

    def query(self, project_id, table_id, filters=None, page=1, limit=50):
        params = f"page={page}&limit={limit}"
        if filters:
            params += f"&filter={json.dumps(filters)}"
        return self._http.get(f"/api/datatables/{project_id}/tables/{table_id}/rows?{params}")

    def insert(self, project_id, table_id, data):
        return self._http.post(f"/api/datatables/{project_id}/tables/{table_id}/rows", {"data": data})


class _Context:
    def __init__(self, base_url, token):
        self.http = _HttpHelper(base_url, token)
        self.variables = _VariablesHelper(self.http)
        self.tables = _TablesHelper(self.http)


context = _Context(${JSON.stringify(baseUrl)}, ${JSON.stringify(authToken)})

# ── User code ────────────────────────────────────────────────────────────
${code}

# ── Execute ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        _params = json.loads(${JSON.stringify(paramsJson)})
        _result = execute(_params, context)
        print("__RESULT_START__")
        print(json.dumps(_result, default=str))
        print("__RESULT_END__")
    except Exception as _e:
        print("__ERROR_START__", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        print("__ERROR_END__", file=sys.stderr)
        sys.exit(1)
`;
}

/**
 * Execute a tool's Python code in a sandboxed subprocess.
 */
export async function executePythonSandbox(
  toolId: string,
  code: string,
  params: Record<string, unknown>,
  options: SandboxOptions = {},
): Promise<SandboxResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const startTime = Date.now();

  try {
    // 1. Ensure venv
    const venvDir = await ensureVenv(toolId);
    const pythonPath = getPythonPath(venvDir);

    // 2. Detect and install dependencies
    const imports = extractImports(code);
    const packages = resolvePackages(imports);
    await installDependencies(venvDir, packages);

    // 3. Generate and write wrapper
    const wrapperCode = generateWrapper(code, params, options);
    const wrapperPath = join(venvDir, "wrapper.py");
    writeFileSync(wrapperPath, wrapperCode);

    // 4. Spawn Python process
    const proc = Bun.spawn([pythonPath, wrapperPath], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        VIRTUAL_ENV: join(venvDir, "venv"),
        PATH: `${join(venvDir, "venv", "bin")}:${process.env.PATH}`,
      },
    });

    // 5. Handle timeout
    const timeoutPromise = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), timeoutMs),
    );

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

    // 6. Read output
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const executionTimeMs = Date.now() - startTime;

    // 7. Parse result
    const resultMatch = stdout.match(/__RESULT_START__\n([\s\S]*?)\n__RESULT_END__/);

    if (resultMatch) {
      try {
        const result = JSON.parse(resultMatch[1]);
        return {
          success: true,
          result,
          executionTimeMs,
          stdout: stdout.replace(/__RESULT_START__[\s\S]*__RESULT_END__/, "").trim(),
          stderr,
        };
      } catch {
        return {
          success: true,
          result: resultMatch[1],
          executionTimeMs,
          stdout: stdout.replace(/__RESULT_START__[\s\S]*__RESULT_END__/, "").trim(),
          stderr,
        };
      }
    }

    // Error case
    const errorMatch = stderr.match(/__ERROR_START__\n([\s\S]*?)\n__ERROR_END__/);
    return {
      success: false,
      result: {
        error: "execution_error",
        message: errorMatch ? errorMatch[1].trim() : stderr.trim() || "Unknown error",
      },
      executionTimeMs,
      stdout: stdout.trim(),
      stderr: stderr.replace(/__ERROR_START__[\s\S]*__ERROR_END__/, "").trim(),
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
 * Clean up venvs not used for more than maxAgeDays.
 */
export function cleanupStaleVenvs(maxAgeDays = 7): number {
  const dataDir = process.env.DATA_DIR ?? `${process.env.HOME}/.gomustack`;
  const venvBaseDir = join(dataDir, "tool-venvs");
  if (!existsSync(venvBaseDir)) return 0;

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let cleaned = 0;

  const entries = readdirSync(venvBaseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const toolDir = join(venvBaseDir, entry.name);
    const lastUsedFile = join(toolDir, "last_used.txt");

    let lastUsed = 0;
    if (existsSync(lastUsedFile)) {
      lastUsed = parseInt(readFileSync(lastUsedFile, "utf-8").trim(), 10) || 0;
    } else {
      // No last_used file — check directory mtime
      lastUsed = statSync(toolDir).mtimeMs;
    }

    if (now - lastUsed > maxAgeMs) {
      rmSync(toolDir, { recursive: true, force: true });
      cleaned++;
    }
  }

  return cleaned;
}
