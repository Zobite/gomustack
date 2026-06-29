import { existsSync, mkdirSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { binaryInfo, clearCache, ensureBinary, launchPersistentContext } from "cloakbrowser";
import { and, eq, like, sql } from "drizzle-orm";
import { getDb } from "../../common/db/client.js";
import { browserProfiles, users } from "../../common/db/schema.js";
import { genId } from "../../common/utils.js";
import type {
  ControlProfileBody,
  CreateProfileBody,
  FingerprintConfig,
  ListProfilesQuery,
  ProxyConfig,
  RunStepsBody,
  SelectorType,
  Step,
  UpdateProfileBody,
} from "./common/schema.js";

// ── CloakBrowser integration ────────────────────────────────────────────────────
// CloakBrowser wraps Playwright with a stealth Chromium binary that passes bot
// detection. Binary auto-downloads on first use (~200MB, cached locally).
// No manual `npx playwright install` needed.

/** Check if CloakBrowser is available and binary is installed */
export async function isPlaywrightAvailable(): Promise<boolean> {
  try {
    const info = binaryInfo();
    return info.installed;
  } catch {
    return false;
  }
}

/** Get CloakBrowser binary info (version, platform, installed status, paths) */
export async function getCloakBinaryInfo(): Promise<any> {
  try {
    return binaryInfo();
  } catch (err: any) {
    return { installed: false, error: err.message };
  }
}

/** Force re-download CloakBrowser binary */
export async function clearCloakCache(): Promise<void> {
  clearCache();
}

/**
 * Pre-download CloakBrowser stealth Chromium binary at server startup.
 * Runs in background — does not block server boot.
 */
export function preloadCloakBrowser(): void {
  (async () => {
    try {
      const info = binaryInfo();
      if (info.installed) {
        console.log(`[browser] ✔ CloakBrowser stealth Chromium ${info.version} ready (${info.platform})`);
        return;
      }
      console.log("[browser] CloakBrowser binary not found. Downloading stealth Chromium...");
      await ensureBinary();
      const updatedInfo = binaryInfo();
      console.log(`[browser] ✔ CloakBrowser stealth Chromium ${updatedInfo.version} downloaded successfully`);
    } catch (err: any) {
      console.warn(`[browser] ⚠ CloakBrowser binary pre-download failed: ${err.message}`);
      console.warn("[browser]   Binary will be downloaded on first browser use instead.");
    }
  })();
}

// Cache for active contexts in memory
interface ActiveProfile {
  context: any; // playwright BrowserContext — typed as any for lazy import
  cdpPort: number;
  wsEndpoint: string;
  lastActivityAt: number;
}
export const activeProfiles = new Map<string, ActiveProfile>();

// Max concurrent browsers limit (defaults to 3, configurable via env)
const MAX_CONCURRENT_BROWSERS = Number(process.env.MAX_CONCURRENT_BROWSERS || 3);

// Idle auto-stop: stop browsers with no activity for N minutes (default 5)
const BROWSER_IDLE_TIMEOUT_MS = (Number(process.env.BROWSER_IDLE_TIMEOUT_MIN) || 5) * 60 * 1000;

/** Touch the lastActivityAt timestamp for a running profile */
function touchActivity(id: string) {
  const active = activeProfiles.get(id);
  if (active) active.lastActivityAt = Date.now();
}

/** Get runtime stats for a running profile */
export function getProfileStats(id: string): { tabCount: number; memoryMB: number } | null {
  const active = activeProfiles.get(id);
  if (!active) return null;
  const tabCount = active.context.pages().length;
  // Report process-level RSS divided by active browser count as a rough per-profile estimate
  const totalRssMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const profileCount = activeProfiles.size || 1;
  const memoryMB = Math.round(totalRssMB / profileCount);
  return { tabCount, memoryMB };
}

// ── Idle Auto-Stop Sweeper ──────────────────────────────────────────────────────
setInterval(async () => {
  const now = Date.now();
  const toStop: string[] = [];
  activeProfiles.forEach((active, id) => {
    const idleMs = now - active.lastActivityAt;
    if (idleMs >= BROWSER_IDLE_TIMEOUT_MS) {
      toStop.push(id);
    }
  });
  for (const id of toStop) {
    console.log(`[browser-sweeper] Auto-stopping idle browser ${id}`);
    try {
      await stopBrowser(id);
    } catch (err) {
      console.error(`[browser-sweeper] Failed to stop browser ${id}:`, err);
    }
  }
}, 60_000);

// Base directory for profile storage
const dataDir = process.env.DATA_DIR ?? `${process.env.HOME}/.gomustack`;
const PROFILES_BASE_DIR = join(dataDir, "browser-profiles");

// ── Screenshot file storage ─────────────────────────────────────────────────────
const SCREENSHOTS_DIR = join(dataDir, "browser-screenshots");
const SCREENSHOT_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// Ensure screenshots directory exists
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

/** Save screenshot buffer to file, return path and relative URL */
export function saveScreenshotToFile(buf: Buffer): { path: string; url: string; filename: string } {
  const random = Math.random().toString(36).substring(2, 8);
  const filename = `screenshot_${Date.now()}_${random}.png`;
  const filepath = join(SCREENSHOTS_DIR, filename);
  writeFileSync(filepath, buf);
  return {
    path: filepath,
    url: `/api/browsers/screenshots/${filename}`,
    filename,
  };
}

/** Get the screenshots directory path */
export function getScreenshotsDir(): string {
  return SCREENSHOTS_DIR;
}

// Screenshot cleanup sweeper — runs every 10 minutes, deletes files > 1 hour old
setInterval(
  () => {
    try {
      if (!existsSync(SCREENSHOTS_DIR)) return;
      const now = Date.now();
      const files = readdirSync(SCREENSHOTS_DIR);
      let cleaned = 0;
      for (const file of files) {
        if (!file.endsWith(".png")) continue;
        const filepath = join(SCREENSHOTS_DIR, file);
        try {
          const stat = statSync(filepath);
          if (now - stat.mtimeMs > SCREENSHOT_MAX_AGE_MS) {
            unlinkSync(filepath);
            cleaned++;
          }
        } catch {
          // Ignore individual file errors
        }
      }
      if (cleaned > 0) {
        console.log(`[screenshot-sweeper] Cleaned up ${cleaned} expired screenshot(s)`);
      }
    } catch (err) {
      console.error("[screenshot-sweeper] Error during cleanup:", err);
    }
  },
  10 * 60 * 1000,
); // Every 10 minutes

/** Find an available random port for CDP debugging */
async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "string" ? 0 : (address?.port ?? 0);
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error("Failed to allocate dynamic port"));
      });
    });
  });
}

/** Retrieve standard WS debugger endpoint from a local port */
async function getWsEndpoint(port: number): Promise<string> {
  const maxRetries = 40;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        const data = (await res.json()) as { webSocketDebuggerUrl?: string };
        if (data.webSocketDebuggerUrl) {
          return data.webSocketDebuggerUrl;
        }
      }
    } catch {
      // Ignore errors and retry as browser may still be starting up
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`CDP debug endpoint on port ${port} did not become ready`);
}

/** Automatically generate a highly realistic modern fingerprint */
function generateDefaultFingerprint(name: string, proxy?: ProxyConfig | null): FingerprintConfig {
  // Common macOS user agents
  const uas = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  ];
  // Select a semi-stable user agent based on profile name length
  const userAgent = uas[name.length % uas.length];

  // Viewports
  const viewports = [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];
  const viewport = viewports[name.length % viewports.length];

  // Try to infer standard language/locale
  const locale = "en-US";
  const timezoneId = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  return {
    userAgent,
    viewport,
    locale,
    timezoneId,
  };
}

export async function listBrowserProfiles(query: ListProfilesQuery, userId?: string) {
  const db = getDb();
  const { page, limit, search } = query;
  const offset = (page - 1) * limit;

  let whereClause: any = undefined;
  if (userId) {
    whereClause = eq(browserProfiles.createdBy, userId);
  }
  if (search) {
    const searchFilter = like(browserProfiles.name, `%${search}%`);
    whereClause = whereClause ? and(whereClause, searchFilter) : searchFilter;
  }

  const items = db.select().from(browserProfiles).where(whereClause).limit(limit).offset(offset).all();

  // Enrich running profiles with runtime stats (tab count + memory)
  const enrichedItems = items.map((item) => {
    const stats = getProfileStats(item.id);
    return {
      ...item,
      tabCount: stats?.tabCount ?? 0,
      memoryMB: stats?.memoryMB ?? 0,
    };
  });

  const countRes = db.select({ count: sql<number>`COUNT(*)` }).from(browserProfiles).where(whereClause).get();

  const total = countRes?.count ?? 0;

  return {
    items: enrichedItems,
    meta: {
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    },
  };
}

export async function getBrowserProfileById(id: string) {
  const db = getDb();
  const profile = db.select().from(browserProfiles).where(eq(browserProfiles.id, id)).get();
  return profile || null;
}

export async function createBrowserProfile(body: CreateProfileBody, userId?: string) {
  const db = getDb();
  const id = genId();
  const userDataDir = join(PROFILES_BASE_DIR, id);

  // Generate beautiful organic fingerprint defaults if missing
  const fingerprintConfig = body.fingerprintConfig || generateDefaultFingerprint(body.name, body.proxyConfig);

  let creatorId = userId;
  if (!creatorId) {
    const firstUser = db.select().from(users).limit(1).get();
    if (!firstUser) {
      throw new Error("No users found in database. Please register a user first.");
    }
    creatorId = firstUser.id;
  }

  const insertData = {
    id,
    name: body.name,
    description: body.description || null,
    userDataDir,
    proxyConfig: body.proxyConfig ? JSON.stringify(body.proxyConfig) : null,
    fingerprintConfig: JSON.stringify(fingerprintConfig),
    status: "idle" as const,
    createdBy: creatorId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.insert(browserProfiles).values(insertData);
  return getBrowserProfileById(id);
}

export async function updateBrowserProfile(id: string, body: UpdateProfileBody) {
  const db = getDb();
  const profile = await getBrowserProfileById(id);
  if (!profile) throw new Error("Profile not found");

  if (profile.status !== "idle") {
    throw new Error("Cannot update configuration while the browser profile is running");
  }

  const updateData: Partial<typeof browserProfiles.$inferInsert> = {
    updatedAt: Date.now(),
  };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.proxyConfig !== undefined) {
    updateData.proxyConfig = body.proxyConfig ? JSON.stringify(body.proxyConfig) : null;
  }
  if (body.fingerprintConfig !== undefined) {
    updateData.fingerprintConfig = body.fingerprintConfig ? JSON.stringify(body.fingerprintConfig) : null;
  }

  await db.update(browserProfiles).set(updateData).where(eq(browserProfiles.id, id));
  return getBrowserProfileById(id);
}

export async function deleteBrowserProfile(id: string) {
  const db = getDb();
  const profile = await getBrowserProfileById(id);
  if (!profile) throw new Error("Profile not found");

  // Force stop browser if running
  try {
    await stopBrowser(id);
  } catch {
    // Ignore stop errors during deletion
  }

  // Delete DB record
  await db.delete(browserProfiles).where(eq(browserProfiles.id, id));

  // Clean up persistent directory recursively
  try {
    if (existsSync(profile.userDataDir)) {
      rmSync(profile.userDataDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Failed to delete userDataDir for profile ${id}:`, err);
  }

  return { id, deleted: true };
}

export async function startBrowser(id: string) {
  const db = getDb();
  const profile = await getBrowserProfileById(id);
  if (!profile) throw new Error("Profile not found");

  // If already running in memory, return it
  if (activeProfiles.has(id)) {
    return activeProfiles.get(id)!;
  }

  // Enforce global concurrency check
  const runningCount = activeProfiles.size;
  if (runningCount >= MAX_CONCURRENT_BROWSERS) {
    throw new Error(`Maximum concurrent running browsers limit (${MAX_CONCURRENT_BROWSERS}) reached. Please stop another profile first.`);
  }

  // Ensure persistent data dir exists
  mkdirSync(profile.userDataDir, { recursive: true });

  const cdpPort = await getFreePort();

  const proxy: ProxyConfig | null = profile.proxyConfig ? JSON.parse(profile.proxyConfig) : null;
  const fingerprint: FingerprintConfig | null = profile.fingerprintConfig ? JSON.parse(profile.fingerprintConfig) : null;

  const args = [`--remote-debugging-port=${cdpPort}`, `--remote-debugging-address=127.0.0.1`];

  // Build CloakBrowser launch options
  const launchOptions: any = {
    headless: true, // Default to headless mode for reliable background running
    args,
  };

  if (proxy) {
    launchOptions.proxy = {
      server: proxy.server,
      username: proxy.username || undefined,
      password: proxy.password || undefined,
    };
  }

  if (fingerprint) {
    if (fingerprint.userAgent) launchOptions.userAgent = fingerprint.userAgent;
    if (fingerprint.viewport) launchOptions.viewport = fingerprint.viewport;
    // CloakBrowser routes locale/timezone through binary flags (undetectable)
    if (fingerprint.locale) launchOptions.locale = fingerprint.locale;
    if (fingerprint.timezoneId) launchOptions.timezone = fingerprint.timezoneId;
    if (fingerprint.geolocation) {
      launchOptions.contextOptions = {
        geolocation: fingerprint.geolocation,
        permissions: ["geolocation"],
      };
    }
  }

  // Launch persistent context via CloakBrowser (stealth Chromium, auto-downloads binary)
  const context = await launchPersistentContext({ ...launchOptions, userDataDir: profile.userDataDir });

  try {
    const wsEndpoint = await getWsEndpoint(cdpPort);

    // Save context to active memory map
    const activeInfo = { context, cdpPort, wsEndpoint, lastActivityAt: Date.now() };
    activeProfiles.set(id, activeInfo);

    // Update DB status to running
    await db
      .update(browserProfiles)
      .set({
        status: "running",
        cdpPort,
        wsEndpoint,
        updatedAt: Date.now(),
      })
      .where(eq(browserProfiles.id, id));

    return activeInfo;
  } catch (err) {
    // If starting up failed, make sure we close the browser context safely
    await context.close().catch(() => {});
    throw err;
  }
}

export async function stopBrowser(id: string) {
  const db = getDb();
  const profile = await getBrowserProfileById(id);
  if (!profile) throw new Error("Profile not found");

  const active = activeProfiles.get(id);
  if (active) {
    try {
      await active.context.close();
    } catch (err) {
      console.error(`Error closing context for profile ${id}:`, err);
    }
    activeProfiles.delete(id);
  }

  // Clean up database state regardless
  await db
    .update(browserProfiles)
    .set({
      status: "idle",
      cdpPort: null,
      wsEndpoint: null,
      pid: null,
      updatedAt: Date.now(),
    })
    .where(eq(browserProfiles.id, id));

  return { id, stopped: true };
}

export async function getActiveTabs(id: string) {
  const active = activeProfiles.get(id);
  if (!active) return [];

  touchActivity(id);

  const pages = active.context.pages();
  const tabs = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    tabs.push({
      index: i,
      url: page.url(),
      title: await page.title().catch(() => "Untitled"),
    });
  }
  return tabs;
}

export async function captureScreenshot(id: string, tabIndex?: number): Promise<Buffer> {
  const active = activeProfiles.get(id);
  if (!active) {
    throw new Error("Browser profile is not running. Please start it first.");
  }

  touchActivity(id);

  const idx = tabIndex ?? 0;
  let page = active.context.pages()[idx];
  if (!page) {
    page = active.context.pages()[0] || (await active.context.newPage());
  }

  // Capture PNG screenshot of current viewport
  return await page.screenshot({ type: "png" });
}

export async function executeBrowserAction(id: string, body: ControlProfileBody) {
  const active = activeProfiles.get(id);
  if (!active) {
    throw new Error("Browser profile is not running. Please start it first.");
  }

  touchActivity(id);

  const { action, url, selector, text, code, tabIndex } = body;
  const idx = tabIndex ?? 0;
  const pagesList = active.context.pages();

  if (action !== "open_tab" && action !== "close_tab" && idx >= pagesList.length) {
    throw new Error(`Tab index ${idx} is out of bounds (total open tabs: ${pagesList.length})`);
  }

  let page = pagesList[idx];
  if (!page && action !== "open_tab") {
    page = pagesList[0] || (await active.context.newPage());
  }

  switch (action) {
    case "open_tab": {
      const newPage = await active.context.newPage();
      if (url) {
        await newPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      }
      return {
        success: true,
        tabIndex: active.context.pages().length - 1,
        url: newPage.url(),
        title: await newPage.title().catch(() => "Untitled"),
      };
    }

    case "close_tab": {
      if (pagesList.length <= 1) {
        throw new Error("Cannot close the only open tab");
      }
      if (idx >= pagesList.length) {
        throw new Error(`Tab index ${idx} is out of bounds (total open tabs: ${pagesList.length})`);
      }
      await pagesList[idx].close();
      return { success: true };
    }

    case "navigate": {
      if (!url) throw new Error("URL is required for navigation");
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      return { url: page.url(), title: await page.title() };
    }

    case "click": {
      if (!selector) throw new Error("Selector is required for click action");
      await page.click(selector, { timeout: 10000 });
      return { success: true };
    }

    case "type": {
      if (!selector) throw new Error("Selector is required for type action");
      if (text === undefined) throw new Error("Text is required for type action");
      await page.type(selector, text, { delay: 50, timeout: 10000 });
      return { success: true };
    }

    case "screenshot": {
      const screenshotBuf = await page.screenshot({ type: "png" });
      return { base64: screenshotBuf.toString("base64") };
    }

    case "get_content": {
      const content = await page.content();
      return {
        url: page.url(),
        title: await page.title(),
        content,
      };
    }

    case "eval": {
      if (!code) throw new Error("Javascript code is required for evaluate action");
      const result = await page.evaluate(code);
      return { result };
    }

    default:
      throw new Error(`Unsupported browser action: ${action}`);
  }
}

// ── Smart Locator Resolution ────────────────────────────────────────────────────

/**
 * Resolve a Playwright locator based on selectorType.
 * Default: CSS selector. Supports text, role, label, placeholder, testid.
 */
function resolveLocator(page: any, selector: string, selectorType?: SelectorType) {
  switch (selectorType) {
    case "text":
      return page.getByText(selector, { exact: false }).first();
    case "role":
      return page.getByRole(selector).first();
    case "label":
      return page.getByLabel(selector).first();
    case "placeholder":
      return page.getByPlaceholder(selector).first();
    case "testid":
      return page.getByTestId(selector).first();
    case "css":
    default:
      return page.locator(selector).first();
  }
}

// ── Shared Step Executor ────────────────────────────────────────────────────────

/**
 * Execute a single browser step on a page. Returns the step result object.
 * Used by both persistent (profile) and ephemeral modes.
 */
async function executeStep(page: any, step: Step, stepTimeout: number): Promise<any> {
  switch (step.action) {
    case "navigate": {
      if (!step.url) throw new Error("URL is required for navigate action");
      await page.goto(step.url, { waitUntil: "domcontentloaded", timeout: stepTimeout });
      return { url: page.url(), title: await page.title().catch(() => "Untitled") };
    }

    case "click": {
      if (!step.selector && !step.text) throw new Error("selector or text is required for click action");
      if (step.text && !step.selector) {
        // Click by visible text
        const locator = page.getByText(step.text, { exact: false }).first();
        await locator.waitFor({ state: "visible", timeout: stepTimeout });
        await locator.click({ timeout: stepTimeout });
      } else {
        const locator = resolveLocator(page, step.selector!, step.selectorType);
        await locator.waitFor({ state: "visible", timeout: stepTimeout });
        await locator.click({ timeout: stepTimeout });
      }
      return { success: true };
    }

    case "type": {
      if (!step.selector) throw new Error("selector is required for type action");
      if (step.text === undefined) throw new Error("text is required for type action");
      const locator = resolveLocator(page, step.selector, step.selectorType);
      await locator.waitFor({ state: "visible", timeout: stepTimeout });
      await locator.fill(step.text);
      return { success: true };
    }

    case "wait": {
      if (!step.selector && !step.text) throw new Error("selector or text is required for wait action");
      if (step.text && !step.selector) {
        await page.getByText(step.text, { exact: false }).first().waitFor({ state: "visible", timeout: stepTimeout });
      } else {
        const locator = resolveLocator(page, step.selector!, step.selectorType);
        await locator.waitFor({ state: "visible", timeout: stepTimeout });
      }
      return { success: true };
    }

    case "sleep": {
      const ms = step.timeout ?? 1000;
      await page.waitForTimeout(ms);
      return { sleptMs: ms };
    }

    case "scroll": {
      const direction = step.direction ?? "down";
      const amount = step.amount ?? 500;
      switch (direction) {
        case "top":
          await page.evaluate(() => window.scrollTo(0, 0));
          break;
        case "bottom":
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          break;
        case "down":
          await page.evaluate((px: number) => window.scrollBy(0, px), amount);
          break;
        case "up":
          await page.evaluate((px: number) => window.scrollBy(0, -px), amount);
          break;
      }
      return { scrolled: direction, pixels: amount };
    }

    case "select": {
      if (!step.selector) throw new Error("selector is required for select action");
      if (!step.value) throw new Error("value is required for select action");
      const locator = resolveLocator(page, step.selector, step.selectorType);
      await locator.selectOption(step.value, { timeout: stepTimeout });
      return { success: true };
    }

    case "press_key": {
      if (!step.key) throw new Error("key is required for press_key action");
      if (step.selector) {
        const locator = resolveLocator(page, step.selector, step.selectorType);
        await locator.press(step.key, { timeout: stepTimeout });
      } else {
        await page.keyboard.press(step.key);
      }
      return { pressed: step.key };
    }

    case "hover": {
      if (!step.selector) throw new Error("selector is required for hover action");
      const locator = resolveLocator(page, step.selector, step.selectorType);
      await locator.hover({ timeout: stepTimeout });
      return { success: true };
    }

    case "extract_text": {
      if (!step.selector) throw new Error("selector is required for extract_text action");
      const locator = resolveLocator(page, step.selector, step.selectorType);
      const text = await locator.textContent({ timeout: stepTimeout });
      return { text: text?.trim() ?? null };
    }

    case "screenshot": {
      const buf = await page.screenshot({ type: "png" });
      const saved = saveScreenshotToFile(buf);
      return { url: saved.url, filename: saved.filename };
    }

    case "get_content": {
      return {
        url: page.url(),
        title: await page.title().catch(() => "Untitled"),
        content: await page.content(),
      };
    }

    case "get_snapshot": {
      const snapshot = await page.locator("body").ariaSnapshot();
      return {
        url: page.url(),
        title: await page.title().catch(() => "Untitled"),
        snapshot,
      };
    }

    case "get_interactive_elements": {
      const elements = await page.evaluate(() => {
        const interactable = document.querySelectorAll(
          'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [onclick], [tabindex]:not([tabindex="-1"])',
        );
        return Array.from(interactable)
          .slice(0, 100)
          .map((el, i) => {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.height > 0 && rect.width > 0;
            const tag = el.tagName.toLowerCase();
            // Build a reliable CSS selector
            let cssSelector = tag;
            if (el.id) cssSelector = `#${el.id}`;
            else if (el.getAttribute("name")) cssSelector = `${tag}[name="${el.getAttribute("name")}"]`;
            else if (el.getAttribute("data-testid")) cssSelector = `[data-testid="${el.getAttribute("data-testid")}"]`;

            return {
              index: i,
              tag,
              type: el.getAttribute("type"),
              role: el.getAttribute("role"),
              text: (el.textContent || "").trim().substring(0, 80) || null,
              placeholder: el.getAttribute("placeholder"),
              ariaLabel: el.getAttribute("aria-label"),
              name: el.getAttribute("name"),
              id: el.id || null,
              href: el.getAttribute("href"),
              selector: cssSelector,
              visible: isVisible,
            };
          });
      });
      return { count: elements.length, elements: elements.filter((e: any) => e.visible) };
    }

    case "eval": {
      if (!step.code) throw new Error("code is required for eval action");
      const evalResult = await page.evaluate(step.code);
      return { result: evalResult };
    }

    default:
      throw new Error(`Unsupported step action: ${(step as any).action}`);
  }
}

/**
 * Get current page state summary (URL + title + focused element).
 */
async function getPageState(page: any): Promise<any> {
  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    focusedElement: await page
      .evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          name: el.getAttribute("name"),
          type: el.getAttribute("type"),
        };
      })
      .catch(() => null),
  };
}

// ── Batch Step Runner ───────────────────────────────────────────────────────────

/**
 * Post-process batch results: prefix screenshot relative URLs with baseUrl.
 * This ensures screenshot URLs are fully qualified (e.g. https://domain.com/api/...).
 */
function prefixScreenshotUrls(results: any[], baseUrl?: string): void {
  if (!baseUrl) return;
  for (const r of results) {
    if (r.success && r.action === "screenshot" && r.result?.url?.startsWith("/")) {
      r.result.url = `${baseUrl.replace(/\/$/, "")}${r.result.url}`;
    }
  }
}

export async function runBatchSteps(body: RunStepsBody & { baseUrl?: string }) {
  const { profileId, tabIndex, steps, continueOnError, includePageState, baseUrl } = body;
  const defaultTimeout = 10000;

  if (profileId) {
    // Persistent Mode (with Profile)
    // 1. Ensure profile is running
    let active = activeProfiles.get(profileId);
    if (!active) {
      active = await startBrowser(profileId);
    }

    // Keep alive — prevent idle sweeper from killing us mid-execution
    touchActivity(profileId);

    // 2. Resolve target page
    let page: Awaited<ReturnType<typeof active.context.newPage>>;
    let shouldClosePage = false;

    if (tabIndex !== undefined && tabIndex !== null) {
      // Reuse an existing tab
      const pages = active.context.pages();
      if (pages.length === 0) {
        throw new Error("Browser has no open tabs. Omit tabIndex to create a new tab.");
      }
      if (tabIndex >= pages.length) {
        throw new Error(`Tab index ${tabIndex} is out of bounds (open tabs: ${pages.length}, valid range: 0–${pages.length - 1})`);
      }
      page = pages[tabIndex];
    } else {
      // Create a dedicated new tab for this execution session
      page = await active.context.newPage();
      shouldClosePage = true;
    }

    page.setDefaultTimeout(defaultTimeout);

    // Determine the actual tab index used (for response)
    const usedTabIndex = active.context.pages().indexOf(page);

    try {
      const results = [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepTimeout = step.timeout ?? defaultTimeout;

        // Keep alive per-step for long-running sequences
        touchActivity(profileId);

        try {
          const stepResult = await executeStep(page, step, stepTimeout);
          // Optionally inject page state
          if (includePageState) {
            stepResult._pageState = await getPageState(page);
          }
          results.push({ step: i + 1, action: step.action, success: true, result: stepResult });
        } catch (err: any) {
          results.push({ step: i + 1, action: step.action, success: false, error: err.message });
          if (!continueOnError) break;
        }
      }
      prefixScreenshotUrls(results, baseUrl);
      return { profileId, persistent: true, tabIndex: usedTabIndex, results };
    } finally {
      // Only close the tab if WE created it (new tab mode)
      if (shouldClosePage) {
        await page.close().catch(() => {});
      }
    }
  } else {
    // Ephemeral Mode (Incognito / No Profile)
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tempDir = join(PROFILES_BASE_DIR, tempId);
    mkdirSync(tempDir, { recursive: true });

    const cdpPort = await getFreePort();
    const args = [`--remote-debugging-port=${cdpPort}`, `--remote-debugging-address=127.0.0.1`];
    const launchOptions: any = {
      headless: true,
      args,
    };

    // Launch ephemeral context via CloakBrowser (stealth Chromium, auto-downloads binary)
    const context = await launchPersistentContext({ ...launchOptions, userDataDir: tempDir });
    const page = context.pages()[0] || (await context.newPage());
    page.setDefaultTimeout(defaultTimeout);

    try {
      const results = [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepTimeout = step.timeout ?? defaultTimeout;
        try {
          const stepResult = await executeStep(page, step, stepTimeout);
          // Optionally inject page state
          if (includePageState) {
            stepResult._pageState = await getPageState(page);
          }
          results.push({ step: i + 1, action: step.action, success: true, result: stepResult });
        } catch (err: any) {
          results.push({ step: i + 1, action: step.action, success: false, error: err.message });
          if (!continueOnError) break;
        }
      }
      prefixScreenshotUrls(results, baseUrl);
      return { profileId: null, persistent: false, results };
    } finally {
      // Shutdown completely and delete temporary directory
      await context.close().catch(() => {});
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error(`Failed to clean up ephemeral directory ${tempDir}:`, err);
      }
    }
  }
}
