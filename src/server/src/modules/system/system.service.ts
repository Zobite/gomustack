import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Injected at build time by `src/server/build.ts` via Bun's `define`.
 * In dev (bun --watch) this is undefined, so we fall back to reading package.json.
 */
declare const __PKG_VERSION__: string | undefined;

let _currentVersion: string | null = null;

/**
 * Walk upward from `startDir` looking for a package.json that contains a version field.
 */
function findVersionUpward(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "package.json");
    try {
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, "utf-8"));
        if (pkg.version) return pkg.version;
      }
    } catch {
      // skip
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return null;
}

export function getCurrentVersion(): string {
  if (_currentVersion && process.env.NODE_ENV !== "development") return _currentVersion;

  // 1. Build-time injected constant (production bundle)
  if (typeof __PKG_VERSION__ !== "undefined") {
    _currentVersion = __PKG_VERSION__;
    return _currentVersion;
  }

  // 2. Dev fallback: walk up from this file's directory to find package.json
  const __dirname = dirname(fileURLToPath(import.meta.url));
  _currentVersion = findVersionUpward(__dirname) ?? "unknown";
  return _currentVersion;
}
