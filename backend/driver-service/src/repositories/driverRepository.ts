import { Knex } from "knex";
import { Driver, NearbyDriver } from "../types/driver";
import { DriverError } from "../errors/DriverError";
export class DriverRepository {
  private db: Knex;

  constructor(db: Knex) {
    this.db = db;
  }

  private mapDriver(row: any): Driver {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      licenseNumber: row.license_number,
      vehicleNumber: row.vehicle_number,
      vehicleType: row.vehicle_type,
      vehicleModel: row.vehicle_model,
      isAvailable: row.is_available,
      isOnline: row.is_online,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      lastLocationAt: row.last_location_at,
    };
  }

  async findAll(): Promise<Driver[]> {
    const rows = await this.db("drivers")
      .select("*")
      .orderBy("created_at", "desc");

    return rows.map((row) => this.mapDriver(row));
  }

  async findById(id: string): Promise<Driver | undefined> {
    const row = await this.db("drivers")
      .where({ id })
      .first();

    if (!row) {
      return undefined;
    }

    return this.mapDriver(row);
  }

  async findByUserId(userId: string): Promise<Driver | undefined> {
    const row = await this.db("drivers")
      .where({ user_id: userId })
      .first();

    if (!row) {
      return undefined;
    }

    return this.mapDriver(row);
  }

  async create(driver: Driver): Promise<Driver> {
    const [row] = await this.db("drivers")
      .insert({
        id: driver.id,
        user_id: driver.userId ?? null,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        license_number: driver.licenseNumber,
        vehicle_number: driver.vehicleNumber,
        vehicle_type: driver.vehicleType,
        vehicle_model: driver.vehicleModel,
        is_available: driver.isAvailable,
        is_online: driver.isOnline ?? false,
        latitude: driver.latitude ?? null,
        longitude: driver.longitude ?? null,
        last_location_at: driver.lastLocationAt ?? null,
      })
      .returning("*");

    return this.mapDriver(row);
  }

  async update(
    id: string,
    driver: Driver
  ): Promise<Driver | undefined> {
    return this.db.transaction(async (trx) => {
      const existing = await trx("drivers")
        .where({ id })
        .forUpdate()
        .first();

      if (!existing) {
        return undefined;
      }

      if (driver.isAvailable) {
        const acceptedRequest = await trx("driver_ride_requests")
          .where({
            driver_id: id,
            status: "ACCEPTED",
          })
          .first();

        if (!existing.is_online || acceptedRequest) {
          throw new DriverError(
            409,
            "Driver availability cannot be enabled while offline or while an accepted ride exists",
            "DRIVER_AVAILABILITY_CONFLICT"
          );
        }
      }

      const [row] = await trx("drivers")
        .where({ id })
        .update({
          user_id: driver.userId ?? null,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
          license_number: driver.licenseNumber,
          vehicle_number: driver.vehicleNumber,
          vehicle_type: driver.vehicleType,
          vehicle_model: driver.vehicleModel,
          is_available: driver.isAvailable,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      return row ? this.mapDriver(row) : undefined;
    });
  }

  async updateOnline(
    id: string,
    isOnline: boolean
  ): Promise<Driver | undefined> {
    return this.db.transaction(async (trx) => {
      const existing = await trx("drivers")
        .where({ id })
        .forUpdate()
        .first();

      if (!existing) {
        return undefined;
      }

      if (isOnline) {
        const acceptedRequest = await trx("driver_ride_requests")
          .where({
            driver_id: id,
            status: "ACCEPTED",
          })
          .first();

        if (acceptedRequest) {
          throw new DriverError(
            409,
            "Driver cannot be switched online while an accepted ride exists",
            "DRIVER_AVAILABILITY_CONFLICT"
          );
        }
      }

      const updateData: Record<string, unknown> = {
        is_online: isOnline,
        updated_at: trx.fn.now(),
      };

      if (!isOnline) {
        updateData.is_available = false;
      }

      const [row] = await trx("drivers")
        .where({ id })
        .update(updateData)
        .returning("*");

      return row ? this.mapDriver(row) : undefined;
    });
  }

  async updateLocation(
    id: string,
    latitude: number,
    longitude: number
  ): Promise<Driver | undefined> {
    const [row] = await this.db("drivers")
      .where({ id })
      .update({
        latitude,
        longitude,
        last_location_at: this.db.fn.now(),
        updated_at: this.db.fn.now(),
      })
      .returning("*");

    if (!row) {
      return undefined;
    }

    return this.mapDriver(row);
  }

  async findNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit: number
  ): Promise<NearbyDriver[]> {
    const rows = await this.db("drivers")
      .select([
        "id",
        "latitude",
        "longitude",
        "vehicle_type",
        "vehicle_model",
      ])
      .where("is_online", true)
      .where("is_available", true)
      .whereNotNull("latitude")
      .whereNotNull("longitude")
      .select(
        this.db.raw(
          `6371 * 2 * ASIN(
            SQRT(
              POWER(SIN(RADIANS(latitude - ?) / 2), 2) +
              COS(RADIANS(?)) *
              COS(RADIANS(latitude)) *
              POWER(SIN(RADIANS(longitude - ?) / 2), 2)
            )
          ) AS distance_km`,
          [latitude, latitude, longitude]
        )
      )
      .whereRaw(
        `6371 * 2 * ASIN(
          SQRT(
            POWER(SIN(RADIANS(latitude - ?) / 2), 2) +
            COS(RADIANS(?)) *
            COS(RADIANS(latitude)) *
            POWER(SIN(RADIANS(longitude - ?) / 2), 2)
          )
        ) <= ?`,
        [latitude, latitude, longitude, radiusKm]
      )
      .orderBy("distance_km", "asc")
      .limit(limit);

    return rows.map((row) => ({
      driverId: row.id,
      distanceKm: Number(row.distance_km),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      vehicleType: row.vehicle_type,
      vehicleModel: row.vehicle_model,
    }));
  }
}
