import { themeQuartz } from "ag-grid-community";

// ── AG Grid custom theme based on GomuStack design tokens ──
export const agentHandsGridTheme = themeQuartz.withParams({
  accentColor: "#26251e",
  backgroundColor: "#ffffff",
  foregroundColor: "#26251e",
  borderColor: "#e6e5e0",
  chromeBackgroundColor: "#fafaf7",
  headerBackgroundColor: "#fafaf7",
  headerTextColor: "#807d72",
  headerFontSize: 11,
  rowHoverColor: "#f7f7f4",
  selectedRowBackgroundColor: "#f0efeb",
  cellHorizontalPaddingScale: 1,
  fontSize: 13,
  fontFamily: "'Inter', system-ui, sans-serif",
  borderRadius: 0,
  wrapperBorderRadius: 0,
  spacing: 6,
});

/**
 * Format an expiresAt timestamp into a human-readable TTL string.
 */
export function formatTTL(expiresAt: number | null): string {
  if (!expiresAt) return "No expiry";
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return "Expired";
  const secs = Math.floor(remaining / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  return `${Math.floor(secs / 86400)}d ${Math.floor((secs % 86400) / 3600)}h`;
}
