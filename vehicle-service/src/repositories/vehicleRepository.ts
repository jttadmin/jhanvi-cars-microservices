import { Knex } from "knex";

import {
  Vehicle,
  VehicleStatus,
  VehicleType
} from "../types/vehicle";

export class VehicleRepository {

  constructor(
    private db: Knex
  ) {}

  private mapVehicle(
    row: any
  ): Vehicle {

    return {
      id: row.id,

      driverId:
        row.driver_id,

      registrationNumber:
        row.registration_number,

      make:
        row.make,

      model:
        row.model,

      year:
        row.year,

      type:
        row.type as VehicleType,

      status:
        row.status as VehicleStatus
    };
  }

  async findAll():
    Promise<Vehicle[]> {

    const rows =
      await this.db("vehicles")
        .select("*")
        .orderBy(
          "created_at",
          "desc"
        );

    return rows.map(
      (row) =>
        this.mapVehicle(row)
    );
  }

  async findById(
    id: string
  ):
    Promise<
      Vehicle | undefined
    > {

    const row =
      await this.db("vehicles")
        .where({ id })
        .first();

    if (!row) {
      return undefined;
    }

    return this.mapVehicle(row);
  }

  async create(
    vehicle: Vehicle
  ): Promise<Vehicle> {

    const [row] =
      await this.db("vehicles")
        .insert({
          id:
            vehicle.id,

          driver_id:
            vehicle.driverId ??
            null,

          registration_number:
            vehicle.registrationNumber,

          make:
            vehicle.make,

          model:
            vehicle.model,

          year:
            vehicle.year,

          type:
            vehicle.type,

          status:
            vehicle.status
        })
        .returning("*");

    return this.mapVehicle(row);
  }

  async update(
    id: string,
    vehicle: Vehicle
  ):
    Promise<
      Vehicle | undefined
    > {

    const [row] =
      await this.db("vehicles")
        .where({ id })
        .update({

          driver_id:
            vehicle.driverId ??
            null,

          registration_number:
            vehicle.registrationNumber,

          make:
            vehicle.make,

          model:
            vehicle.model,

          year:
            vehicle.year,

          type:
            vehicle.type,

          status:
            vehicle.status,

          updated_at:
            this.db.fn.now()
        })
        .returning("*");

    if (!row) {
      return undefined;
    }

    return this.mapVehicle(row);
  }
}
