/**
 * Browser-like fetch utility
 *
 * Mimics a real browser request with randomized User-Agent and proper headers
 * to avoid 400/403 rejections from APIs like TikTok, Twitter, Instagram, etc.
 */

// Real browser User-Agent strings (kept up to date)
const USER_AGENTS = [
  // Chrome on macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  // Chrome on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  // Firefox on macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:124.0) Gecko/20100101 Firefox/124.0",
  // Firefox on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  // Safari on macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  // Edge on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

/**
 * Detect if the UA is Firefox (Firefox has different sec-ch-ua support)
 */
function isFirefox(ua: string): boolean {
  return ua.includes("Firefox");
}

/**
 * Detect if the UA is Safari (not Chrome-based)
 */
function isSafari(ua: string): boolean {
  return ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Edg");
}

/**
 * Build browser-like headers for a given UA
 */
function buildHeaders(ua: string, url: string): Record<string, string> {
  const origin = new URL(url).origin;

  const base: Record<string, string> = {
    "User-Agent": ua,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };

  // Chrome/Edge: add Client Hints
  if (!isFirefox(ua) && !isSafari(ua)) {
    const isEdge = ua.includes("Edg/");
    const brand = isEdge ? "Microsoft Edge" : "Chromium";
    const chromeMatch = ua.match(/Chrome\/([\d]+)/);
    const version = chromeMatch ? chromeMatch[1] : "124";

    base["sec-ch-ua"] = `"${brand}";v="${version}", "Not-A.Brand";v="99", "Google Chrome";v="${version}"`;
    base["sec-ch-ua-mobile"] = "?0";
    base["sec-ch-ua-platform"] = ua.includes("Windows") ? '"Windows"' : '"macOS"';
    base["Sec-Fetch-Dest"] = "document";
    base["Sec-Fetch-Mode"] = "navigate";
    base["Sec-Fetch-Site"] = "none";
    base["Sec-Fetch-User"] = "?1";
  }

  // Firefox: add DNT
  if (isFirefox(ua)) {
    base["DNT"] = "1";
    base["Sec-Fetch-Dest"] = "document";
    base["Sec-Fetch-Mode"] = "navigate";
    base["Sec-Fetch-Site"] = "none";
    base["Sec-Fetch-User"] = "?1";
  }

  return base;
}

/**
 * Fetch a URL mimicking a real browser request.
 * Randomizes User-Agent and sends all the right headers.
 */
export async function fetchBrowser(url: string, timeoutMs = 10_000, customHeaders?: Record<string, string>): Promise<Response> {
  const ua = randomUA();
  const headers = { ...buildHeaders(ua, url), ...customHeaders };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers,
      // Follow redirects (default in fetch)
      redirect: "follow",
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}
