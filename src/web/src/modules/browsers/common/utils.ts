/**
 * Parse a JSON fingerprint config string into a readable summary.
 * Returns viewport + locale when available, "Default" otherwise.
 */
export function getFingerprintSummary(configStr: string | null): string {
  if (!configStr) return "Default";
  try {
    const config = JSON.parse(configStr);
    const width = config.viewport?.width || 1280;
    const height = config.viewport?.height || 800;
    const locale = config.locale || "en-US";
    return `${width}×${height} · ${locale}`;
  } catch {
    return "Custom";
  }
}

/**
 * Parse a JSON proxy config string into a display-friendly host string.
 * Returns the host portion only (auth stripped).
 */
export function getProxyDisplay(proxyStr: string | null): string {
  if (!proxyStr) return "Direct";
  try {
    const proxy = JSON.parse(proxyStr);
    const url = new URL(proxy.server);
    return url.host;
  } catch {
    return proxyStr;
  }
}

/**
 * Format a Unix timestamp into a relative "time ago" string.
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
