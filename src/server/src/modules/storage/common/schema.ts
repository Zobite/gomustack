import { z } from "zod";

// ── Bucket naming: S3-compatible (lowercase alphanumeric + hyphens, 3-63 chars) ─
const BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export const createBucketBodySchema = z.object({
  name: z
    .string()
    .min(3)
    .max(63)
    .regex(BUCKET_NAME_PATTERN, "Bucket name must be lowercase alphanumeric + hyphens, 3-63 chars"),
  isPublic: z.boolean().optional().default(false),
});

export const updateBucketBodySchema = z.object({
  isPublic: z.boolean(),
});

export const deleteBucketQuerySchema = z.object({
  force: z.coerce.boolean().optional().default(false),
});

export const listObjectsQuerySchema = z.object({
  prefix: z.string().optional(),
  delimiter: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  search: z.string().optional(),
});

export const updateObjectBodySchema = z.object({
  isPublic: z.boolean(),
});

export const presignBodySchema = z.object({
  expiresIn: z.number().int().min(1).max(604800).optional().default(3600),
});

export const createAccessKeyBodySchema = z.object({
  label: z.string().min(1).max(255),
});

export const updateAccessKeyBodySchema = z.object({
  label: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
});

// ── Inferred Types ──────────────────────────────────────────────────────────────

export type CreateBucketBody = z.infer<typeof createBucketBodySchema>;
export type UpdateBucketBody = z.infer<typeof updateBucketBodySchema>;
export type DeleteBucketQuery = z.infer<typeof deleteBucketQuerySchema>;
export type ListObjectsQuery = z.infer<typeof listObjectsQuerySchema>;
export type UpdateObjectBody = z.infer<typeof updateObjectBodySchema>;
export type PresignBody = z.infer<typeof presignBodySchema>;
export type CreateAccessKeyBody = z.infer<typeof createAccessKeyBodySchema>;
export type UpdateAccessKeyBody = z.infer<typeof updateAccessKeyBodySchema>;
