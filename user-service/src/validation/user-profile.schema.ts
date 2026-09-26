import { z } from 'zod';

export const updateUserProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional(),

    bio: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),

    avatarUrl: z
      .string()
      .trim()
      .url()
      .max(500)
      .nullable()
      .optional()
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    {
      message: 'At least one profile field is required'
    }
  );

export type UpdateUserProfileInput =
  z.infer<typeof updateUserProfileSchema>;
