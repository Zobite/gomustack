import { z } from "zod";

// ── Dynamic API CRUD Schemas ────────────────────────────────────────────────────

export const createDynamicApiBodySchema = z.object({
  name: z.string().min(1).max(255),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  path: z.string().min(1).max(500).refine((p) => p.startsWith("/"), {
    message: "Path must start with /",
  }),
  description: z.string().max(2000).optional(),
  code: z.string().default(`export default async function handler(request, context) {
  // request: { method, path, params, query, headers, body }
  // context: { log }
  //
  // Return: { status, headers?, body }

  context.log("Hello from handler!");

  return {
    status: 200,
    body: { message: "Hello World" }
  };
}`),
  dependencies: z.record(z.string()).optional(), // { "axios": "^1.7.0" }
  isPublic: z.boolean().optional().default(false),
  timeout: z.number().int().min(1000).max(300000).optional().default(30000),
});

export const updateDynamicApiBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  path: z
    .string()
    .min(1)
    .max(500)
    .refine((p) => p.startsWith("/"), { message: "Path must start with /" })
    .optional(),
  description: z.string().max(2000).nullable().optional(),
  code: z.string().optional(),
  draftCode: z.string().nullable().optional(),
  dependencies: z.record(z.string()).nullable().optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  timeout: z.number().int().min(1000).max(300000).optional(),
});

export const listDynamicApiQuerySchema = z.object({
  search: z.string().optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listDynamicApiLogsQuerySchema = z.object({
  status: z.enum(["success", "error"]).optional(),
  startDate: z.coerce.number().optional(), // epoch milliseconds (Date.now())
  endDate: z.coerce.number().optional(),   // epoch milliseconds (Date.now())
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const dryRunBodySchema = z.object({
  source: z.enum(["prod", "draft"]).default("draft"),
  code: z.string().optional(),
  method: z.string().optional(),
  path: z.string().optional(),
  params: z.record(z.string()).optional().default({}),
  query: z.record(z.string()).optional().default({}),
  headers: z.record(z.string()).optional().default({}),
  body: z.any().optional().default(null),
  timeout: z.number().int().min(1000).max(60000).optional().default(30000),
});

// ── Inferred Types ──────────────────────────────────────────────────────────────

export type CreateDynamicApiBody = z.infer<typeof createDynamicApiBodySchema>;
export type UpdateDynamicApiBody = z.infer<typeof updateDynamicApiBodySchema>;
export type ListDynamicApiQuery = z.infer<typeof listDynamicApiQuerySchema>;
export type ListDynamicApiLogsQuery = z.infer<typeof listDynamicApiLogsQuerySchema>;
export type DryRunBody = z.infer<typeof dryRunBodySchema>;
