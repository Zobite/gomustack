/**
 * Suppress Monaco-editor's harmless lifecycle errors that occur during
 * React unmount / transitions. These are internal Monaco timing issues
 * and don't affect functionality.
 *
 * This module is side-effect only — import it once and the listeners
 * are registered. Subsequent imports are no-ops.
 */

let installed = false;

const MONACO_ERROR_PATTERNS = [
  "TextModel got disposed before DiffEditorWidget",
  "Cannot read properties of undefined (reading 'isVisible')",
  "Cannot set properties of undefined (setting 'orientation')",
  "Cannot read properties of null (reading 'getVersionId')",
  "Unexpected missing view model",
];

function isMonacoError(msg: string | undefined | null): boolean {
  return msg != null && MONACO_ERROR_PATTERNS.some((p) => msg.includes(p));
}

export function installMonacoErrorSuppressor() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // ── Intercept window "error" (uncaught synchronous throws) ────────────
  window.addEventListener("error", (e) => {
    if (isMonacoError(e.message) || isMonacoError(e.error?.message)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    }
  });

  // ── Intercept window "unhandledrejection" ─────────────────────────────
  window.addEventListener("unhandledrejection", (e) => {
    const msg = e.reason?.message || (typeof e.reason === "string" ? e.reason : "");
    if (isMonacoError(msg)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  });

  // ── Patch console.error to suppress Monaco lifecycle noise ────────────
  // Monaco internally logs the error via console.error before it throws,
  // so window "error" alone can't prevent the red console line.
  const origConsoleError = console.error;
  console.error = function (...args: unknown[]) {
    const first = args[0];
    if (first instanceof Error && isMonacoError(first.message)) return;
    if (typeof first === "string" && isMonacoError(first)) return;
    // Some Monaco errors come as: "Uncaught Error: TextModel got..."
    if (args.length > 0) {
      const joined = args.map((a) => (a instanceof Error ? a.message : String(a))).join(" ");
      if (isMonacoError(joined)) return;
    }
    origConsoleError.apply(console, args);
  };
}
