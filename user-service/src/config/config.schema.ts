import { z } from 'zod';

export const configSchema = z.object({
  port: z.number().int().positive(),
  serviceName: z.string().min(1),
  nodeEnv: z.string().min(1),
  dbSchema: z.string().min(1),
  databaseUrl: z.string().min(1),
  jwtSecret: z.string().min(1),
  authServiceUrl: z.string().url()
});
