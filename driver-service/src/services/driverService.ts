import { Driver } from "../types/driver";
import { DriverRepository } from "../repositories/driverRepository";

export class DriverService {
  constructor(private repository: DriverRepository) {}

  async getAllDrivers(): Promise<Driver[]> {
    return this.repository.findAll();
  }

  async getDriverById(id: string): Promise<Driver | undefined> {
    return this.repository.findById(id);
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
}
