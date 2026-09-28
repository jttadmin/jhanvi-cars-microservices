import { Knex } from "knex";

import {
  Booking,
  BookingStatus
} from "../types/booking";

export class BookingRepository {

  constructor(
    private db: Knex
  ) {}

  private mapBooking(
    row: any
  ): Booking {

    return {
      id: row.id,

      userId:
        row.user_id,

      driverId:
        row.driver_id,

      pickupLocation:
        row.pickup_location,

      dropoffLocation:
        row.dropoff_location,

      scheduledAt:
        new Date(
          row.scheduled_at
        ).toISOString(),

      status:
        row.status as BookingStatus,

      fare:
        Number(row.fare),

      vehicleType:
        row.vehicle_type ?? undefined
    };
  }

  async findAll():
    Promise<Booking[]> {

    const rows =
      await this.db("bookings")
        .select("*")
        .orderBy(
          "created_at",
          "desc"
        );

    return rows.map(
      (row) =>
        this.mapBooking(row)
    );
  }

  async findById(
    id: string
  ): Promise<
    Booking | undefined
  > {

    const row =
      await this.db("bookings")
        .where({ id })
        .first();

    if (!row) {
      return undefined;
    }

    return this.mapBooking(row);
  }

  async create(
    booking: Booking
  ): Promise<Booking> {

    const [row] =
      await this.db("bookings")
        .insert({
          id: booking.id,

          user_id:
            booking.userId,

          driver_id:
            booking.driverId ??
            null,

          pickup_location:
            booking.pickupLocation,

          dropoff_location:
            booking.dropoffLocation,

          scheduled_at:
            booking.scheduledAt,

          status:
            booking.status,

          fare:
            booking.fare,

          vehicle_type:
            booking.vehicleType ?? null
        })
        .returning("*");

    return this.mapBooking(row);
  }

  async update(
    id: string,
    booking: Booking
  ): Promise<
    Booking | undefined
  > {

    const [row] =
      await this.db("bookings")
        .where({ id })
        .update({

          user_id:
            booking.userId,

          driver_id:
            booking.driverId ??
            null,

          pickup_location:
            booking.pickupLocation,

          dropoff_location:
            booking.dropoffLocation,

          scheduled_at:
            booking.scheduledAt,

          status:
            booking.status,

          fare:
            booking.fare,

          vehicle_type:
            booking.vehicleType ?? null,

          updated_at:
            this.db.fn.now()
        })
        .returning("*");

    if (!row) {
      return undefined;
    }

    return this.mapBooking(row);
  }
}
