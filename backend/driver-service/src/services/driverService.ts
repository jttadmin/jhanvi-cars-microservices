import { Driver, NearbyDriver } from "../types/driver";
import { DriverRepository } from "../repositories/driverRepository";
import { getDriverRatingSummary } from "../clients/booking.client";

export class DriverService {
  constructor(private repository: DriverRepository) {}

  async getAllDrivers(): Promise<Driver[]> {
    return this.repository.findAll();
  }

  async getDriverById(id: string): Promise<Driver | undefined> {
    return this.repository.findById(id);
  }

  async getDriverByUserId(userId: string): Promise<Driver | undefined> {
    return this.repository.findByUserId(userId);
  }

  async getDriverProfileByUserId(
    userId: string
  ): Promise<
    | (Driver & {
        rating: {
          averageRating: number;
          totalRatings: number;
        };
      })
    | undefined
  > {
    const driver =
      await this.repository.findByUserId(userId);

    if (!driver) {
      return undefined;
    }

    const rating =
      await getDriverRatingSummary(driver.id);

    return {
      ...driver,
      rating,
    };
  }

  async createDriver(driver: Driver): Promise<Driver> {
    return this.repository.create(driver);
  }

  async updateDriver(
    id: string,
    data: Omit<Driver, "id">
  ): Promise<Driver | undefined> {
    const existingDriver = await this.repository.findById(id);

    if (!existingDriver) {
      return undefined;
    }

    return this.repository.update(id, {
      id,
      ...data,
    });
  }

  async updateDriverStatus(
    id: string,
    isAvailable: boolean
  ): Promise<Driver | undefined> {
    const driver = await this.repository.findById(id);

    if (!driver) {
      return undefined;
    }

    return this.repository.update(id, {
      ...driver,
      isAvailable,
    });
  }

  async updateDriverOnline(
    id: string,
    isOnline: boolean
  ): Promise<Driver | undefined> {
    const driver = await this.repository.findById(id);

    if (!driver) {
      return undefined;
    }

    return this.repository.updateOnline(id, isOnline);
  }

  async updateDriverLocation(
    id: string,
    latitude: number,
    longitude: number
  ): Promise<Driver | undefined> {
    const driver = await this.repository.findById(id);

    if (!driver) {
      return undefined;
    }

    return this.repository.updateLocation(id, latitude, longitude);
  }

  async getDriverPresence(
    id: string
  ): Promise<Driver | undefined> {
    return this.repository.findById(id);
  }

  async getDriverRatingSummary(
    id: string
  ): Promise<{
    averageRating: number;
    totalRatings: number;
  }> {
    return getDriverRatingSummary(id);
  }


  async getNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit: number
  ): Promise<NearbyDriver[]> {
    return this.repository.findNearbyDrivers(
      latitude,
      longitude,
      radiusKm,
      limit
    );
  }
}
