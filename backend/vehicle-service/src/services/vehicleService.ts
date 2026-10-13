import {
  Vehicle,
  VehicleStatus
} from "../types/vehicle";

import {
  VehicleRepository
} from "../repositories/vehicleRepository";

import {
  MemcachedService
} from "../cache/memcachedService";

import {
  validateDriverExists,
  DriverValidationError
} from "../clients/driver.client";

export class VehicleService {

  private cache: MemcachedService;

  constructor(
    private repository: VehicleRepository
  ) {
    this.cache = new MemcachedService();
  }

  async getAllVehicles(): Promise<Vehicle[]> {

    const cacheKey = "vehicles:all";

    const cached =
      await this.cache.get<Vehicle[]>(cacheKey);

    if (cached) {
      console.log(
        "Vehicle cache HIT:",
        cacheKey
      );

      return cached;
    }

    console.log(
      "Vehicle cache MISS:",
      cacheKey
    );

    const vehicles =
      await this.repository.findAll();

    await this.cache.set(
      cacheKey,
      vehicles
    );

    return vehicles;
  }

  async getVehicleById(
    id: string
  ): Promise<Vehicle | undefined> {

    const cacheKey =
      `vehicle:${id}`;

    const cached =
      await this.cache.get<Vehicle>(cacheKey);

    if (cached) {
      console.log(
        "Vehicle cache HIT:",
        cacheKey
      );

      return cached;
    }

    console.log(
      "Vehicle cache MISS:",
      cacheKey
    );

    const vehicle =
      await this.repository.findById(id);

    if (vehicle) {
      await this.cache.set(
        cacheKey,
        vehicle
      );
    }

    return vehicle;
  }

  async createVehicle(
    vehicle: Vehicle
  ): Promise<Vehicle> {

    if (vehicle.driverId) {
      await validateDriverExists(vehicle.driverId);
    }

    const created =
      await this.repository.create(vehicle);

    await this.invalidateVehicleCache(
      vehicle.id
    );

    return created;
  }

  async updateVehicle(
    id: string,
    data: Omit<
      Vehicle,
      "id" | "status"
    >
  ): Promise<Vehicle | undefined> {

    const existing =
      await this.repository.findById(id);

    if (!existing) {
      return undefined;
    }

    // An omitted driverId means "leave the current assignment unchanged".
    // An explicit null means "remove the assignment".
    const effectiveDriverId =
      data.driverId === undefined
        ? existing.driverId ?? null
        : data.driverId;

    const assignmentChanging =
      effectiveDriverId !== (existing.driverId ?? null);

    if (assignmentChanging && existing.status === "IN_USE") {
      throw new DriverValidationError(
        "Cannot change the driver assignment while the vehicle is in use",
        409
      );
    }

    if (effectiveDriverId) {
      await validateDriverExists(effectiveDriverId);
    }

    const updated =
      await this.repository.update(
        id,
        {
          id,
          ...data,
          driverId: effectiveDriverId,
          status: existing.status
        }
      );

    await this.invalidateVehicleCache(id);

    if (updated) {
      await this.cache.set(
        `vehicle:${id}`,
        updated
      );
    }

    return updated;
  }

  async updateVehicleStatus(
    id: string,
    status: VehicleStatus
  ): Promise<Vehicle | undefined> {

    const existing =
      await this.repository.findById(id);

    if (!existing) {
      return undefined;
    }

    const updated =
      await this.repository.update(
        id,
        {
          ...existing,
          status
        }
      );

    await this.invalidateVehicleCache(id);

    if (updated) {
      await this.cache.set(
        `vehicle:${id}`,
        updated
      );
    }

    return updated;
  }

  private async invalidateVehicleCache(
    id: string
  ): Promise<void> {

    await this.cache.delete(
      `vehicle:${id}`
    );

    await this.cache.delete(
      "vehicles:all"
    );
  }
}
