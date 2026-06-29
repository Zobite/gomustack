import { z } from "zod";

// ── MCP Tool Server Schemas ─────────────────────────────────────────────────

export const createMcpServerBodySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Name may only contain alphanumeric, hyphen, underscore"),
  description: z.string().max(1000).optional(),
  extendsBuiltin: z.array(z.string()).optional(),
});

export const updateMcpServerBodySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Name may only contain alphanumeric, hyphen, underscore")
    .optional(),
  description: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
  extendsBuiltin: z.array(z.string()).optional(),
});

export const mcpServerIdParamsSchema = z.object({
  id: z.string(),
});

// ── MCP Tool Schemas ────────────────────────────────────────────────────────

export const createMcpToolBodySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, "Tool name must be snake_case (lowercase alphanumeric + underscore)"),
  description: z.string().max(2000).default(""),
  inputSchema: z.string().optional(), // JSON Schema string
  code: z.string().default(""),
});

export const updateMcpToolBodySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, "Tool name must be snake_case")
    .optional(),
  description: z.string().max(2000).optional(),
  inputSchema: z.string().nullable().optional(),
  code: z.string().min(1).optional(),
  draftCode: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const mcpToolIdParamsSchema = z.object({
  id: z.string(),
  toolId: z.string(),
});

export const testMcpToolBodySchema = z.object({
  params: z.record(z.unknown()).optional(),
  source: z.enum(["prod", "draft"]).optional().default("draft"),
});

export const listMcpToolsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ── Inferred Types ──────────────────────────────────────────────────────────

export type CreateMcpServerBody = z.infer<typeof createMcpServerBodySchema>;
export type UpdateMcpServerBody = z.infer<typeof updateMcpServerBodySchema>;
export type CreateMcpToolBody = z.infer<typeof createMcpToolBodySchema>;
export type UpdateMcpToolBody = z.infer<typeof updateMcpToolBodySchema>;
export type TestMcpToolBody = z.infer<typeof testMcpToolBodySchema>;
export type ListMcpToolsQuery = z.infer<typeof listMcpToolsQuerySchema>;
