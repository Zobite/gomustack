import { z } from "zod";

// ── Project CRUD Schemas ────────────────────────────────────────────────────────

export const createProjectBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  icon: z.string().max(32).optional(),
});

export const updateProjectBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  icon: z.string().max(32).nullable().optional(),
});

// ── Inferred Types ──────────────────────────────────────────────────────────────

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;

// ── Filter Operators ────────────────────────────────────────────────────────────

export const FILTER_OPERATORS = [
  "eq",        // equals
  "neq",       // not equals
  "contains",  // text contains (case-insensitive)
  "not_contains", // text does not contain
  "starts_with",  // text starts with
  "ends_with",    // text ends with
  "gt",        // greater than
  "gte",       // greater than or equal
  "lt",        // less than
  "lte",       // less than or equal
  "is_empty",  // value is null/empty
  "is_not_empty", // value is not null/empty
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export const filterConditionSchema = z.object({
  columnId: z.string().optional(), // internal column ID (col_xxx) — used by UI
  column: z.string().optional(),   // column name (human-readable) — used by LLMs/API
  operator: z.enum(FILTER_OPERATORS),
  value: z.unknown().optional(),
});

export type FilterCondition = z.infer<typeof filterConditionSchema>;

// ── Column Types ────────────────────────────────────────────────────────────────

export const COLUMN_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
] as const;

export type ColumnType = (typeof COLUMN_TYPES)[number];

// ── Column Definition Schema ────────────────────────────────────────────────────

export const columnDefSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  type: z.enum(COLUMN_TYPES),
  order: z.number().int().min(0),
  required: z.boolean().optional().default(false),
  options: z
    .object({
      // For number: format
      numberFormat: z.enum(["integer", "decimal", "currency", "percent"]).optional(),
      // For date: include time
      includeTime: z.boolean().optional(),
    })
    .optional()
    .default({}),
});

export type ColumnDef = z.infer<typeof columnDefSchema>;

// ── Table CRUD Schemas ──────────────────────────────────────────────────────────

export const createTableBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  icon: z.string().max(32).optional(),
  columns: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        type: z.enum(COLUMN_TYPES),
        options: columnDefSchema.shape.options,
      }),
    )
    .min(1, "At least 1 column is required"),
});

export const updateTableBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  icon: z.string().max(32).nullable().optional(),
});

// ── Column Management Schemas ───────────────────────────────────────────────────

export const addColumnBodySchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(COLUMN_TYPES),
  options: columnDefSchema.shape.options,
});

export const updateColumnBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(COLUMN_TYPES).optional(),
  options: columnDefSchema.shape.options.optional(),
});

// ── Row CRUD Schemas ────────────────────────────────────────────────────────────

export const createRowBodySchema = z.object({
  data: z.record(z.string(), z.unknown()).optional().default({}),
});

export const updateRowBodySchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export const listRowsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.string().optional(),     // "created_at" | "updated_at" | "col_xxx:asc" | "col_xxx:desc"
  order: z.enum(["asc", "desc"]).optional(),
  filter: z.string().optional(),   // JSON-encoded FilterCondition[]
  filterLogic: z.enum(["and", "or"]).optional(), // default: "and"
});

export const bulkDeleteRowsBodySchema = z.object({
  rowIds: z.array(z.string()).min(1).max(500),
});

export const bulkUpdateRowsBodySchema = z.object({
  updates: z
    .array(
      z.object({
        rowId: z.string(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1)
    .max(500),
});

// ── Inferred Types ──────────────────────────────────────────────────────────────

export type CreateTableBody = z.infer<typeof createTableBodySchema>;
export type UpdateTableBody = z.infer<typeof updateTableBodySchema>;
export type AddColumnBody = z.infer<typeof addColumnBodySchema>;
export type UpdateColumnBody = z.infer<typeof updateColumnBodySchema>;
export type CreateRowBody = z.infer<typeof createRowBodySchema>;
export type UpdateRowBody = z.infer<typeof updateRowBodySchema>;
export type ListRowsQuery = z.infer<typeof listRowsQuerySchema>;
export type BulkDeleteRowsBody = z.infer<typeof bulkDeleteRowsBodySchema>;
export type BulkUpdateRowsBody = z.infer<typeof bulkUpdateRowsBodySchema>;
