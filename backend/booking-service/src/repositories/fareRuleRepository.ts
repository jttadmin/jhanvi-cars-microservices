import { Knex } from "knex";

import {
  FareRule,
  RideCategory,
  UpdateFareRuleInput
} from "../types/fareRule";

export class FareRuleRepository {
  constructor(private db: Knex) {}

  private map(row: any): FareRule {
    return {
      vehicleType: row.vehicle_type,
      minFare: Number(row.min_fare),
      minKm: Number(row.min_km),
      perKm: Number(row.per_km),
      nightStart: row.night_start,
      nightEnd: row.night_end,
      nightSurchargePercent: Number(row.night_surcharge_percent),
      gstPercent: Number(row.gst_percent),
      source: row.source ?? null,
      updatedBy: row.updated_by ?? null,
      updatedAt: row.updated_at
        ? new Date(row.updated_at).toISOString()
        : undefined,
    };
  }

  async findAll(): Promise<FareRule[]> {
    const rows = await this.db("fare_rules").select("*");
    return rows.map((row) => this.map(row));
  }

  async findByType(
    vehicleType: RideCategory
  ): Promise<FareRule | undefined> {
    const row = await this.db("fare_rules")
      .where({ vehicle_type: vehicleType })
      .first();
    return row ? this.map(row) : undefined;
  }

  async update(
    vehicleType: RideCategory,
    input: UpdateFareRuleInput,
    updatedBy: string | null
  ): Promise<FareRule | undefined> {
    const [row] = await this.db("fare_rules")
      .where({ vehicle_type: vehicleType })
      .update({
        min_fare: input.minFare,
        min_km: input.minKm,
        per_km: input.perKm,
        night_start: input.nightStart,
        night_end: input.nightEnd,
        night_surcharge_percent: input.nightSurchargePercent,
        gst_percent: input.gstPercent,
        ...(input.source !== undefined ? { source: input.source } : {}),
        updated_by: updatedBy,
        updated_at: this.db.fn.now(),
      })
      .returning("*");

    return row ? this.map(row) : undefined;
  }
}
