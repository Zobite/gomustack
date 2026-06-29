import { z } from "zod";

// ── Request Schemas ─────────────────────────────────────────────────────────────

export const createUserBodySchema = z.object({
  username: z.string().min(2).max(32),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["admin", "member"]).optional(),
});

export const updateUserBodySchema = z.object({
  username: z.string().min(2).max(32).optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["admin", "member"]).optional(),
});

export const userIdParamsSchema = z.object({
  id: z.string(),
});

/** Admin reset password for any user (no old password required) */
export const adminResetPasswordBodySchema = z.object({
  password: z.string().min(8),
});

// ── Inferred Types ──────────────────────────────────────────────────────────────

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type AdminResetPasswordBody = z.infer<typeof adminResetPasswordBodySchema>;
