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
}
