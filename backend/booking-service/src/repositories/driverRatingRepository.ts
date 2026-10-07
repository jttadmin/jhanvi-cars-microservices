import { Knex } from "knex";

import {
  DriverRating
} from "../types/driverRating";

export class DriverRatingRepository {

  constructor(
    private db: Knex
  ) {}

  private mapRating(
    row: any
  ): DriverRating {

    return {
      id:
        row.id,

      bookingId:
        row.booking_id,

      customerId:
        row.customer_id,

      driverId:
        row.driver_id,

      rating:
        Number(row.rating),

      comment:
        row.comment ?? null,

      createdAt:
        row.created_at
          ? new Date(
              row.created_at
            ).toISOString()
          : undefined,

      updatedAt:
        row.updated_at
          ? new Date(
              row.updated_at
            ).toISOString()
          : undefined
    };
  }

  async create(
    rating: DriverRating
  ): Promise<DriverRating> {

    const [row] =
      await this.db
        .withSchema("booking_schema")
        .table("driver_ratings")
        .insert({
          id:
            rating.id,

          booking_id:
            rating.bookingId,

          customer_id:
            rating.customerId,

          driver_id:
            rating.driverId,

          rating:
            rating.rating,

          comment:
            rating.comment ?? null
        })
        .returning("*");

    return this.mapRating(row);
  }

  async findByBookingId(
    bookingId: string
  ): Promise<
    DriverRating | undefined
  > {

    const row =
      await this.db
        .withSchema("booking_schema")
        .table("driver_ratings")
        .where({
          booking_id:
            bookingId
        })
        .first();

    if (!row) {
      return undefined;
    }

    return this.mapRating(row);
  }

  async getDriverRatingSummary(
    driverId: string
  ): Promise<{
    averageRating: number;
    totalRatings: number;
  }> {

    const row =
      await this.db
        .withSchema("booking_schema")
        .table("driver_ratings")
        .where({
          driver_id:
            driverId
        })
        .select(
          this.db.raw(
            "COALESCE(AVG(rating), 0)::numeric as average_rating"
          ),
          this.db.raw(
            "COUNT(*)::int as total_ratings"
          )
        )
        .first();

    return {
      averageRating:
        Number(
          Number(
            row?.average_rating ?? 0
          ).toFixed(2)
        ),

      totalRatings:
        Number(
          row?.total_ratings ?? 0
        )
    };
  }

  async findByDriverId(
    driverId: string
  ): Promise<DriverRating[]> {

    const rows =
      await this.db
        .withSchema("booking_schema")
        .table("driver_ratings")
        .where({
          driver_id:
            driverId
        })
        .orderBy(
          "created_at",
          "desc"
        );

    return rows.map(
      (row) =>
        this.mapRating(row)
    );
  }
}
