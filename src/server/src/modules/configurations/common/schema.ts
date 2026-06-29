import { z } from "zod";

export const ConfigurationSchema = z.object({
  key: z.string(),
  value: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const SetConfigurationBody = z.object({
  value: z.string(),
});

export const BatchGetConfigurationsBody = z.object({
  keys: z.array(z.string()).min(1),
});

export type ConfigurationResponse = z.infer<typeof ConfigurationSchema>;
