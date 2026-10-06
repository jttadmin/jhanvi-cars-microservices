import { z } from "zod";

export const bookingStatusSchema =
  z.enum([
    "PENDING",
    "CONFIRMED",
    "ONGOING",
    "COMPLETED",
    "CANCELLED"
  ]);


export const vehicleTypeSchema =
  z.enum([
    "AUTO",
    "ECONOMY",
    "COMFORT",
    "COMFORT_PLUS"
  ]);

export const createBookingSchema =
  z.object({
    userId:
      z.string().min(1).optional(),

    driverId:
      z.string().min(1).nullable().optional(),

    pickupLocation:
      z.string().min(2),

    pickupLatitude:
      z.number().min(-90).max(90).nullable().optional(),

    pickupLongitude:
      z.number().min(-180).max(180).nullable().optional(),

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
      z.number().nonnegative(),

    vehicleType:
      vehicleTypeSchema
  });

export const updateBookingSchema =
  z.object({
    userId:
      z.string().min(1),

    driverId:
      z.string().min(1).nullable().optional(),

    pickupLocation:
      z.string().min(2),

    pickupLatitude:
      z.number().min(-90).max(90).nullable().optional(),

    pickupLongitude:
      z.number().min(-180).max(180).nullable().optional(),

    dropoffLocation:
      z.string().min(2),

    scheduledAt:
      z.string().datetime({
        offset: true
      }),

    fare:
      z.number().nonnegative(),

    vehicleType:
      vehicleTypeSchema.optional()
  });

export const updateBookingStatusSchema =
  z.object({
    status:
      bookingStatusSchema
  });
