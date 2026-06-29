import { z } from "zod";

// Proxy configuration schema
export const proxyConfigSchema = z.object({
  server: z.string().url("Proxy server must be a valid URL (e.g. http://ip:port or http://username:password@ip:port)"),
  username: z.string().optional(),
  password: z.string().optional(),
});

// Fingerprint configuration schema
export const fingerprintConfigSchema = z.object({
  userAgent: z.string().optional(),
  viewport: z
    .object({
      width: z.number().int().min(320).max(3840).default(1280),
      height: z.number().int().min(240).max(2160).default(800),
    })
    .optional(),
  locale: z.string().optional(),
  timezoneId: z.string().optional(),
  geolocation: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().min(0).optional(),
    })
    .optional(),
});

// Create profile request schema
export const createProfileBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  proxyConfig: proxyConfigSchema.optional().nullable(),
  fingerprintConfig: fingerprintConfigSchema.optional().nullable(),
});

// Update profile request schema
export const updateProfileBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  proxyConfig: proxyConfigSchema.optional().nullable(),
  fingerprintConfig: fingerprintConfigSchema.optional().nullable(),
});

// List profiles query schema
export const listProfilesQuerySchema = z.object({
  page: z.preprocess((val) => Number(val || 1), z.number().int().min(1)).default(1),
  limit: z.preprocess((val) => Number(val || 10), z.number().int().min(1).max(100)).default(10),
  search: z.string().optional(),
});

// ── All supported step actions ──────────────────────────────────────────────────
export const STEP_ACTIONS = [
  "navigate",
  "click",
  "type",
  "screenshot",
  "get_content",
  "eval",
  "wait",
  "sleep",
  "scroll",
  "select",
  "press_key",
  "hover",
  "extract_text",
  "get_snapshot",
  "get_interactive_elements",
] as const;

// ── Selector type for smart element resolution ──────────────────────────────────
export const SELECTOR_TYPES = [
  "css",
  "text",
  "role",
  "label",
  "placeholder",
  "testid",
] as const;

// ── Step schema shared by run_steps and quick_run ───────────────────────────────
export const stepSchema = z.object({
  action: z.enum(STEP_ACTIONS),
  url: z.string().optional(),
  selector: z.string().optional(),
  text: z.string().optional(),
  code: z.string().optional(),
  timeout: z.number().int().min(0).optional(),
  // Smart selector type (default: css)
  selectorType: z.enum(SELECTOR_TYPES).optional(),
  // For press_key action
  key: z.string().optional(),
  // For select action
  value: z.string().optional(),
  // For scroll action
  direction: z.enum(["up", "down", "top", "bottom"]).optional(),
  amount: z.number().int().min(0).optional(),
});

// Control browser actions schema (legacy single-action endpoint)
export const controlProfileBodySchema = z.object({
  action: z.enum(["navigate", "click", "type", "screenshot", "get_content", "eval", "open_tab", "close_tab"]),
  tabIndex: z.number().int().min(0).optional(),
  url: z.string().url("Must be a valid URL").optional(),
  selector: z.string().optional(),
  text: z.string().optional(),
  code: z.string().optional(),
});

// Run sequence/batch steps schema
export const runStepsBodySchema = z.object({
  profileId: z.string().optional().nullable(),
  tabIndex: z.number().int().min(0).optional(),
  steps: z.array(stepSchema).min(1, "At least one step is required"),
  continueOnError: z.boolean().optional().default(false),
  includePageState: z.boolean().optional().default(false),
});

// Typings derived from schemas
export type ProxyConfig = z.infer<typeof proxyConfigSchema>;
export type FingerprintConfig = z.infer<typeof fingerprintConfigSchema>;
export type CreateProfileBody = z.infer<typeof createProfileBodySchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
export type ListProfilesQuery = z.infer<typeof listProfilesQuerySchema>;
export type ControlProfileBody = z.infer<typeof controlProfileBodySchema>;
export type RunStepsBody = z.infer<typeof runStepsBodySchema>;
export type StepAction = (typeof STEP_ACTIONS)[number];
export type SelectorType = (typeof SELECTOR_TYPES)[number];
export type Step = z.infer<typeof stepSchema>;
export type BrowserProfileStatus = "idle" | "running" | "error";
