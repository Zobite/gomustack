import { z } from "zod";

export const loginBodySchema = z.object({
  login: z.string().min(1), // username or email
  password: z.string().min(1),
});

export const refreshBodySchema = z.object({
  refresh_token: z.string().min(1),
});

export const changePasswordBodySchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(8),
});

export const setupBodySchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type SetupBody = z.infer<typeof setupBodySchema>;
