import { Request, Response } from "express";
import { DriverService } from "../services/driverService";
import {
  createDriverSchema,
  updateDriverSchema,
  updateDriverStatusSchema,
} from "../types/driverSchema";

export class DriverController {
  constructor(private service: DriverService) {}

  getAllDrivers = async (_req: Request, res: Response) => {
    const drivers = await this.service.getAllDrivers();

    return res.json(drivers);
  };

  getDriverById = async (req: Request, res: Response) => {
    const id = String(req.params.id);

    const driver = await this.service.getDriverById(id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    return res.json(driver);
  };

  createDriver = async (req: Request, res: Response) => {
    const result = createDriverSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid driver data",
        errors: result.error.flatten(),
      });
    }

    const driver = await this.service.createDriver(result.data);

    return res.status(201).json(driver);
  };

  updateDriver = async (req: Request, res: Response) => {
    const result = updateDriverSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid driver data",
        errors: result.error.flatten(),
      });
    }

    const id = String(req.params.id);

    const driver = await this.service.updateDriver(
      id,
      result.data
    );

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    return res.json(driver);
  };

  updateDriverStatus = async (req: Request, res: Response) => {
    const result = updateDriverStatusSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid status data",
        errors: result.error.flatten(),
      });
    }

    const id = String(req.params.id);

    const driver = await this.service.updateDriverStatus(
      id,
      result.data.isAvailable
    );

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    return res.json(driver);
  };
}
