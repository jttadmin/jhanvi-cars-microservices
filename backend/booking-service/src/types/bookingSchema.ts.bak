import { z } from "zod";

export const bookingStatusSchema =
  z.enum([
    "PENDING",
    "CONFIRMED",
    "ONGOING",
    "COMPLETED",
    "CANCELLED"
  ]);

export const createBookingSchema =
  z.object({
    userId:
      z.string().min(1).optional(),

    driverId:
      z.string().min(1).nullable().optional(),

    pickupLocation:
      z.string().min(2),

    dropoffLocation:
      z.string().min(2),

    scheduledAt:
      z.string().datetime({
        offset: true
      }),

    status:
      bookingStatusSchema
        .optional()
        .default("PENDING"),

    fare:
      z.number().nonnegative()
  });

export const updateBookingSchema =
  z.object({
    userId:
      z.string().min(1),

    driverId:
      z.string().min(1).nullable().optional(),

    pickupLocation:
      z.string().min(2),

    dropoffLocation:
      z.string().min(2),

    scheduledAt:
      z.string().datetime({
        offset: true
      }),

    fare:
      z.number().nonnegative()
  });

export const updateBookingStatusSchema =
  z.object({
    status:
      bookingStatusSchema
  });
