import { z } from 'zod';

// Zod, not Joi: schemas double as TypeScript types via z.infer, so the
// validated shape and the type used in services/controllers never drift.
export const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  mobileNumber: z
    .string()
    .regex(/^[0-9]{10}$/, 'mobileNumber must be exactly 10 digits'),
  password: z.string().min(8).max(72),
  role: z.enum(['CUSTOMER', 'DRIVER', 'ADMIN']).optional().default('CUSTOMER'),
  licenseNumber: z.string().min(1).optional(),
  vehicleNumber: z.string().min(1).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;
