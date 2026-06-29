import { z } from "zod";

// ── Key validation ──────────────────────────────────────────────────────────────

const KEY_PATTERN = /^[a-zA-Z0-9._-]+$/;

// ── Request Schemas ─────────────────────────────────────────────────────────────

export const createVariableBodySchema = z.object({
  key: z
    .string()
    .min(1)
    .max(255)
    .regex(KEY_PATTERN, "Key may only contain alphanumeric, hyphen, underscore, dot"),
  value: z.string(),
  type: z.enum(["string", "number", "boolean", "json"]).optional(),
  ttl: z.number().int().min(0).optional(), // seconds, 0 = no expiry
});

export const updateVariableBodySchema = z.object({
  value: z.string().optional(),
  type: z.enum(["string", "number", "boolean", "json"]).optional(),
  ttl: z.number().int().min(0).nullable().optional(), // null = clear TTL
});

export const bulkCreateBodySchema = z.object({
  variables: z.array(createVariableBodySchema).min(1).max(100),
});

export const listVariablesQuerySchema = z.object({
  search: z.string().optional(),
  sort: z.enum(["key", "type", "updated_at", "ttl"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const variableIdParamsSchema = z.object({
  id: z.string(),
});

export const variableKeyParamsSchema = z.object({
  key: z.string(),
});

// ── Inferred Types ──────────────────────────────────────────────────────────────

export type CreateVariableBody = z.infer<typeof createVariableBodySchema>;
export type UpdateVariableBody = z.infer<typeof updateVariableBodySchema>;
export type BulkCreateBody = z.infer<typeof bulkCreateBodySchema>;
export type ListVariablesQuery = z.infer<typeof listVariablesQuerySchema>;
