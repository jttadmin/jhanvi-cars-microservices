import { z } from "zod";

const vehicleTypeSchema = z.enum([
  "AUTO",
  "ECONOMY",
  "COMFORT",
  "COMFORT_PLUS",
]);

export const createDriverSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1).nullable().optional(),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  licenseNumber: z.string().min(1),
  vehicleNumber: z.string().min(1),
  vehicleType: vehicleTypeSchema,
  vehicleModel: z.string().min(2),
  isAvailable: z.boolean(),
});

export const updateDriverSchema = z.object({
  userId: z.string().min(1).nullable().optional(),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  licenseNumber: z.string().min(1),
  vehicleNumber: z.string().min(1),
  vehicleType: vehicleTypeSchema,
  vehicleModel: z.string().min(2),
  isAvailable: z.boolean(),
});

export const updateDriverStatusSchema = z.object({
  isAvailable: z.boolean(),
});

export const updateDriverOnlineSchema = z.object({
  isOnline: z.boolean()
});

export const updateDriverLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

export const nearbyDriversQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(50).default(5),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
