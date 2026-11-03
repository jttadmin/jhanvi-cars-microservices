import { Request, Response } from "express";

import { FareService } from "../services/fareService";
import { vehicleTypeSchema } from "../types/bookingSchema";
import {
  fareQuoteSchema,
  updateFareRuleSchema
} from "../types/fareRule";

export class FareController {
  constructor(private service: FareService) {}

  /** GET /bookings/fare-rules: current rates, any signed-in user. */
  getRules = async (_req: Request, res: Response) => {
    return res.json(await this.service.getRules());
  };

  /** POST /bookings/fare-quote: fares for every category for a trip. */
  quote = async (req: Request, res: Response) => {
    const result = fareQuoteSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid fare quote request",
        errors: result.error.flatten(),
      });
    }

    const at = result.data.scheduledAt
      ? new Date(result.data.scheduledAt)
      : new Date();

    return res.json(
      await this.service.quoteAll(result.data.distanceKm, at)
    );
  };

  /** PUT /bookings/fare-rules/:vehicleType: admin only. */
  updateRule = async (req: Request, res: Response) => {
    if (req.auth?.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admins can change fares",
      });
    }

    const type = vehicleTypeSchema.safeParse(req.params.vehicleType);

    if (!type.success) {
      return res.status(404).json({ message: "Unknown ride category" });
    }

    const result = updateFareRuleSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid fare rule",
        errors: result.error.flatten(),
      });
    }

    return res.json(
      await this.service.updateRule(
        type.data,
        result.data,
        req.auth?.id ?? null
      )
    );
  };
}
