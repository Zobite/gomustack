import { Component, type ReactNode } from "react";

/**
 * Known harmless Monaco Editor lifecycle errors that occur during
 * React unmount / DiffEditor transitions. These are internal Monaco
 * timing issues and never affect real functionality.
 */
const KNOWN_MONACO_ERRORS = [
  "TextModel got disposed before DiffEditorWidget",
  "Cannot read properties of undefined (reading 'isVisible')",
  "Cannot set properties of undefined (setting 'orientation')",
  "Cannot read properties of null (reading 'getVersionId')",
  "Unexpected missing view model",
];

function isMonacoLifecycleError(error: unknown): boolean {
  if (error instanceof Error) {
    return KNOWN_MONACO_ERRORS.some((p) => error.message.includes(p));
  }
  if (typeof error === "string") {
    return KNOWN_MONACO_ERRORS.some((p) => error.includes(p));
  }
  return false;
}

interface Props {
  children: ReactNode;
  /** Optional fallback to show when a non-Monaco error crashes */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  isMonacoError: boolean;
}

/**
 * Error boundary that catches Monaco Editor lifecycle errors during
 * component unmount / re-mount. These are harmless internal timing
 * issues and should NOT crash the entire page.
 *
 * For Monaco errors: the boundary resets itself on the next render
 * so the editor can be re-created cleanly.
 *
 * For non-Monaco errors: shows the fallback (or null).
 */
export class MonacoErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isMonacoError: false };
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: unknown): State {
    if (isMonacoLifecycleError(error)) {
      // Monaco lifecycle error — we'll auto-recover
      return { hasError: true, isMonacoError: true };
    }
    // Real error — show fallback
    return { hasError: true, isMonacoError: false };
  }

  componentDidCatch(error: unknown) {
    if (isMonacoLifecycleError(error)) {
      // Auto-reset after a frame so the editor can re-mount cleanly
      this.resetTimer = setTimeout(() => {
        this.setState({ hasError: false, isMonacoError: false });
      }, 50);
    }
  }

  componentWillUnmount() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isMonacoError) {
        // Monaco lifecycle error — render nothing briefly, will auto-recover
        return null;
      }
      // Real error — show fallback
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
