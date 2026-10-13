import { Knex } from "knex";
import { randomUUID } from "crypto";
import {
  DriverRideRequest,
  DriverRideRequestStatus,
} from "../types/driverRideRequest";

export class DriverRideRequestRepository {
  constructor(private readonly db: Knex) {}

  private mapRow(row: any): DriverRideRequest {
    return {
      id: row.id,
      bookingId: row.booking_id,
      driverId: row.driver_id,
      pickupLatitude: Number(row.pickup_latitude),
      pickupLongitude: Number(row.pickup_longitude),
      status: row.status as DriverRideRequestStatus,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      respondedAt: row.responded_at,
    };
  }

  async createRideRequest(input: {
    bookingId: string;
    driverId: string;
    pickupLatitude: number;
    pickupLongitude: number;
    expiresAt: Date;
  }): Promise<DriverRideRequest> {
    const id = randomUUID();

    const [row] = await this.db("driver_ride_requests")
      .insert({
        id,
        booking_id: input.bookingId,
        driver_id: input.driverId,
        pickup_latitude: input.pickupLatitude,
        pickup_longitude: input.pickupLongitude,
        status: "OFFERED",
        expires_at: input.expiresAt,
      })
      .returning("*");

    return this.mapRow(row);
  }

  async findByDriverId(
    driverId: string
  ): Promise<DriverRideRequest[]> {
    const rows = await this.db("driver_ride_requests")
      .where("driver_id", driverId)
      .orderBy("created_at", "desc");

    return rows.map((row) => this.mapRow(row));
  }

  async findDriverIdsByBookingId(
    bookingId: string
  ): Promise<string[]> {
    const rows = await this.db("driver_ride_requests")
      .where("booking_id", bookingId)
      .select("driver_id");

    return rows.map(
      (row) => String(row.driver_id)
    );
  }

  async findByIdForDriver(
    id: string,
    driverId: string
  ): Promise<DriverRideRequest | null> {
    const row = await this.db("driver_ride_requests")
      .where({
        id,
        driver_id: driverId,
      })
      .first();

    return row ? this.mapRow(row) : null;
  }

  async acceptRideRequest(
    id: string,
    driverId: string
  ): Promise<DriverRideRequest | null> {
    return this.db.transaction(async (trx) => {
      const driver = await trx("drivers")
        .where("id", driverId)
        .forUpdate()
        .first();

      if (!driver || !driver.is_online || !driver.is_available) {
        return null;
      }

      const [row] = await trx("driver_ride_requests")
        .where({
          id,
          driver_id: driverId,
          status: "OFFERED",
        })
        .where("expires_at", ">", trx.fn.now())
        .update({
          status: "ACCEPTED",
          responded_at: trx.fn.now(),
        })
        .returning("*");

      if (!row) {
        return null;
      }

      await trx("drivers")
        .where("id", driverId)
        .update({
          is_available: false,
          updated_at: trx.fn.now(),
        });

      return this.mapRow(row);
    });
  }

  async findExpiredOfferedRideRequestIds(
    limit = 100
  ): Promise<string[]> {
    const rows = await this.db("driver_ride_requests")
      .where("status", "OFFERED")
      .where("expires_at", "<=", this.db.fn.now())
      .select("id")
      .orderBy("expires_at", "asc")
      .limit(limit);

    return rows.map((row) => String(row.id));
  }

  async expireRideRequest(
    id: string
  ): Promise<DriverRideRequest | null> {
    const [row] = await this.db("driver_ride_requests")
      .where({
        id,
        status: "OFFERED",
      })
      .where("expires_at", "<=", this.db.fn.now())
      .update({
        status: "EXPIRED",
        responded_at: this.db.fn.now(),
      })
      .returning("*");

    return row ? this.mapRow(row) : null;
  }

  async rejectRideRequest(
    id: string,
    driverId: string
  ): Promise<DriverRideRequest | null> {
    const [row] = await this.db("driver_ride_requests")
      .where({
        id,
        driver_id: driverId,
        status: "OFFERED",
      })
      .where("expires_at", ">", this.db.fn.now())
      .update({
        status: "REJECTED",
        responded_at: this.db.fn.now(),
      })
      .returning("*");

    return row ? this.mapRow(row) : null;
  }

  async cancelConflictingAcceptance(
    id: string,
    driverId: string
  ): Promise<boolean> {
    return this.db.transaction(async (trx) => {
      const driver = await trx("drivers")
        .where("id", driverId)
        .forUpdate()
        .first();

      if (!driver) {
        return false;
      }

      const [row] = await trx("driver_ride_requests")
        .where({
          id,
          driver_id: driverId,
          status: "ACCEPTED",
        })
        .update({
          status: "CANCELLED",
          responded_at: trx.fn.now(),
        })
        .returning("id");

      if (!row) {
        return false;
      }

      // Keep the driver unavailable after a conflicting acceptance.
      // Do not overwrite a possible manual availability change.
      return true;
    });
  }


  async cancelRideRequest(
    bookingId: string,
    driverId: string
  ): Promise<DriverRideRequest | null> {
    return this.db.transaction(async (trx) => {
      const driver = await trx("drivers")
        .where("id", driverId)
        .forUpdate()
        .first();

      if (!driver) return null;

      const [row] = await trx("driver_ride_requests")
        .where({
          booking_id: bookingId,
          driver_id: driverId,
          status: "ACCEPTED",
        })
        .update({
          status: "CANCELLED",
          responded_at: trx.fn.now(),
        })
        .returning("*");

      if (row) return this.mapRow(row);

      const cancelled = await trx("driver_ride_requests")
        .where({
          booking_id: bookingId,
          driver_id: driverId,
          status: "CANCELLED",
        })
        .first();

      return cancelled ? this.mapRow(cancelled) : null;
    });
  }

  async completeRideRequest(
    bookingId: string,
    driverId: string
  ): Promise<DriverRideRequest | null> {
    return this.db.transaction(async (trx) => {
      const driver = await trx("drivers")
        .where("id", driverId)
        .forUpdate()
        .first();

      if (!driver) {
        return null;
      }

      const [row] = await trx("driver_ride_requests")
        .where({
          booking_id: bookingId,
          driver_id: driverId,
          status: "ACCEPTED",
        })
        .update({
          status: "COMPLETED",
          responded_at: trx.fn.now(),
        })
        .returning("*");

      if (row) {
        return this.mapRow(row);
      }

      // Make retries idempotent for this exact booking and driver.
      const completed = await trx("driver_ride_requests")
        .where({
          booking_id: bookingId,
          driver_id: driverId,
          status: "COMPLETED",
        })
        .first();

      return completed ? this.mapRow(completed) : null;
    });
  }

}
