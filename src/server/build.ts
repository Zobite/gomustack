/**
 * Build script for the server.
 * Reads version from root package.json and injects it as a compile-time constant.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPkg = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8"));
const version: string = rootPkg.version ?? "0.0.0";

console.log(`Building server... (version: ${version})`);

await Bun.build({
  entrypoints: [join(__dirname, "src", "index.ts")],
  outdir: join(__dirname, "..", "..", "dist"),
  target: "bun",
  sourcemap: "none",
  external: ["playwright", "playwright-core"],
  define: {
    "__PKG_VERSION__": JSON.stringify(version),
  },
});

console.log("Done.");
