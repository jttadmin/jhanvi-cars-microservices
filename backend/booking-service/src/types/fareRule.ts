import { z } from "zod";

import { vehicleTypeSchema } from "./bookingSchema";

export type RideCategory = z.infer<typeof vehicleTypeSchema>;

export interface FareRule {
  vehicleType: RideCategory;
  /** Fare charged for the first `minKm` kilometres. */
  minFare: number;
  minKm: number;
  /** Charged for every kilometre after `minKm`. */
  perKm: number;
  /** Local (Asia/Kolkata) HH:MM; the window may cross midnight. */
  nightStart: string;
  nightEnd: string;
  nightSurchargePercent: number;
  gstPercent: number;
  /** Which notification the rates come from. */
  source?: string | null;
  updatedBy?: string | null;
  updatedAt?: string;
}

export interface FareQuote {
  vehicleType: RideCategory;
  distanceKm: number;
  minFare: number;
  distanceFare: number;
  nightSurcharge: number;
  gst: number;
  total: number;
  isNight: boolean;
}

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");

const money = z.number().finite().nonnegative().max(100000);

export const updateFareRuleSchema = z.object({
  minFare: money,
  minKm: z.number().finite().nonnegative().max(100),
  perKm: money,
  nightStart: hhmm,
  nightEnd: hhmm,
  nightSurchargePercent: z.number().finite().min(0).max(100),
  gstPercent: z.number().finite().min(0).max(28),
  source: z.string().trim().max(255).nullable().optional(),
});

export type UpdateFareRuleInput = z.infer<typeof updateFareRuleSchema>;

export const fareQuoteSchema = z.object({
  distanceKm: z.number().finite().positive().max(5000),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});
