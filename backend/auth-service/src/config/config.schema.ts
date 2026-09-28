import { z } from 'zod';

export const staticConfigSchema = z.object({
  port: z.number().int().positive(),
  serviceName: z.string().min(1),
  nodeEnv: z.string().min(1),
  dbSchema: z.string().min(1),
  authProvider: z.string().min(1),
  jwtExpiresIn: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+(ms|s|m|h|d|w|y)$/),
  ]),
  secretFilePath: z.string().min(1).optional(),
});

export const secretConfigSchema = z.object({
  databaseUrl: z.string().min(1),
  jwtSecret: z.string().min(1),
});

export const runtimeConfigSchema =
  staticConfigSchema.merge(secretConfigSchema);