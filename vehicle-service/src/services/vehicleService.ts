import {
  Vehicle,
  VehicleStatus
} from "../types/vehicle";

import {
  VehicleRepository
} from "../repositories/vehicleRepository";

export class VehicleService {

  constructor(
    private repository:
      VehicleRepository
  ) {}

  async getAllVehicles():
    Promise<Vehicle[]> {

    return this.repository
      .findAll();
  }

  async getVehicleById(
    id: string
  ):
    Promise<
      Vehicle | undefined
    > {

    return this.repository
      .findById(id);
  }

  async createVehicle(
    vehicle: Vehicle
  ): Promise<Vehicle> {

    return this.repository
      .create(vehicle);
  }

  async updateVehicle(
    id: string,

    data: Omit<
      Vehicle,
      "id" | "status"
    >
  ):
    Promise<
      Vehicle | undefined
    > {

    const existing =
      await this.repository
        .findById(id);

    if (!existing) {
      return undefined;
    }

    return this.repository.update(
      id,
      {
        id,

        ...data,

        status:
          existing.status
      }
    );
  }

  async updateVehicleStatus(
    id: string,

    status: VehicleStatus
  ):
    Promise<
      Vehicle | undefined
    > {

    const existing =
      await this.repository
        .findById(id);

    if (!existing) {
      return undefined;
    }

    return this.repository.update(
      id,
      {
        ...existing,

        status
      }
    );
  }
}
