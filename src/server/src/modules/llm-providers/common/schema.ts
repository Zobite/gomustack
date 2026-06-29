import { z } from "zod";

// ── Provider Types ──────────────────────────────────────────────────────────────

export const PROVIDER_TYPES = [
  "openrouter",
  "openai",
  "gemini",
  "anthropic",
  "ollama",
  "custom",
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

// ── Default Base URLs ───────────────────────────────────────────────────────────

export const DEFAULT_BASE_URLS: Record<ProviderType, string | null> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  ollama: "http://localhost:11434",
  custom: null, // must be provided
};

// ── Request Schemas ─────────────────────────────────────────────────────────────

export const createLlmProviderBodySchema = z.object({
  name: z.string().min(1).max(100),
  providerType: z.enum(PROVIDER_TYPES),
  apiKey: z.string().default(""),
  baseUrl: z.string().url().optional().or(z.literal("")),
});

export const updateLlmProviderBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional().or(z.literal("")).or(z.null()),
});

export const llmProviderIdParamsSchema = z.object({
  id: z.string(),
});

// ── Inferred Types ──────────────────────────────────────────────────────────────

export type CreateLlmProviderBody = z.infer<typeof createLlmProviderBodySchema>;
export type UpdateLlmProviderBody = z.infer<typeof updateLlmProviderBodySchema>;
export type LlmProviderIdParams = z.infer<typeof llmProviderIdParamsSchema>;
