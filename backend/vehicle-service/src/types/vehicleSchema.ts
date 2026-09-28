import { z } from "zod";

export const vehicleTypeSchema =
  z.enum([
    "SEDAN",
    "SUV",
    "HATCHBACK",
    "LUXURY",
    "MUV"
  ]);

export const vehicleStatusSchema =
  z.enum([
    "AVAILABLE",
    "IN_USE",
    "MAINTENANCE",
    "INACTIVE"
  ]);

export const createVehicleSchema =
  z.object({
    driverId:
      z.string().min(1).nullable().optional(),

    registrationNumber:
      z.string()
        .min(3)
        .max(20),

    make:
      z.string().min(2),

    model:
      z.string().min(1),

    year:
      z.number()
        .int()
        .min(1900)
        .max(2100),

    type:
      vehicleTypeSchema,

    status:
      vehicleStatusSchema
        .optional()
        .default("AVAILABLE")
  });

export const updateVehicleSchema =
  z.object({
    driverId:
      z.string().min(1).nullable().optional(),

    registrationNumber:
      z.string()
        .min(3)
        .max(20),

    make:
      z.string().min(2),

    model:
      z.string().min(1),

    year:
      z.number()
        .int()
        .min(1900)
        .max(2100),

    type:
      vehicleTypeSchema
  });

export const updateVehicleStatusSchema =
  z.object({
    status:
      vehicleStatusSchema
  });
