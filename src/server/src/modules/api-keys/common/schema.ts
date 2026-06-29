import { z } from "zod";

// ── Request schemas ─────────────────────────────────────────────────────────────

export const createApiKeyBodySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).optional().default(["*"]),
  expiresAt: z.number().int().positive().optional(),  // epoch ms
});

export type CreateApiKeyBody = z.infer<typeof createApiKeyBodySchema>;

// ── Response types ──────────────────────────────────────────────────────────────

export interface ApiKeyResponse {
  id: string;
  name: string;
  prefix: string;
  userId: string;
  permissions: string[];
  lastUsedAt: number | null;
  expiresAt: number | null;
  createdAt: number;
}

export interface CreateApiKeyResponse extends ApiKeyResponse {
  /** The raw API key — shown only once at creation time */
  key: string;
}
