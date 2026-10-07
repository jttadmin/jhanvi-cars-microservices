import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { DriverService } from "../services/driverService";
import {
  createDriverSchema,
  updateDriverSchema,
  updateDriverStatusSchema,
  updateDriverOnlineSchema,
  updateDriverLocationSchema,
  nearbyDriversQuerySchema,
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

  getOwnProfile = async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (req.user.role !== "DRIVER") {
      return res.status(403).json({
        message: "Only drivers can access this profile",
      });
    }

    const driver = await this.service.getDriverByUserId(req.user.sub);

    console.log("[GET /drivers/me] userId:", req.user.sub);
    console.log("[GET /drivers/me] driverFound:", Boolean(driver));

    if (!driver) {
      return res.status(404).json({
        message: "Driver profile not found",
      });
    }

    return res.json(driver);
  };

  updateOwnStatus = async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (req.user.role !== "DRIVER") {
      return res.status(403).json({
        message: "Only drivers can update their availability",
      });
    }

    const driver = await this.service.getDriverByUserId(req.user.sub);

    console.log("[GET /drivers/me] userId:", req.user.sub);
    console.log("[GET /drivers/me] driverFound:", Boolean(driver));

    if (!driver) {
      return res.status(404).json({
        message: "Driver profile not found",
      });
    }

    const result = updateDriverStatusSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid status data",
        errors: result.error.flatten(),
      });
    }

    const updatedDriver = await this.service.updateDriverStatus(
      driver.id,
      result.data.isAvailable
    );

    if (!updatedDriver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    return res.json(updatedDriver);
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

  updateOwnOnline = async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (req.user.role !== "DRIVER") {
      return res.status(403).json({
        message: "Only drivers can update their online status",
      });
    }

    const result = updateDriverOnlineSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid online status data",
        errors: result.error.flatten(),
      });
    }

    const driver = await this.service.getDriverByUserId(req.user.sub);

    if (!driver) {
      return res.status(404).json({
        message: "Driver profile not found",
      });
    }

    const updatedDriver = await this.service.updateDriverOnline(
      driver.id,
      result.data.isOnline
    );

    if (!updatedDriver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    return res.json(updatedDriver);
  };

  updateOwnLocation = async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (req.user.role !== "DRIVER") {
      return res.status(403).json({
        message: "Only drivers can update their location",
      });
    }

    const result = updateDriverLocationSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid location data",
        errors: result.error.flatten(),
      });
    }

    const driver = await this.service.getDriverByUserId(req.user.sub);

    if (!driver) {
      return res.status(404).json({
        message: "Driver profile not found",
      });
    }

    const updatedDriver = await this.service.updateDriverLocation(
      driver.id,
      result.data.latitude,
      result.data.longitude
    );

    if (!updatedDriver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    return res.json(updatedDriver);
  };

  getOwnPresence = async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (req.user.role !== "DRIVER") {
      return res.status(403).json({
        message: "Only drivers can access presence",
      });
    }

    const driver = await this.service.getDriverByUserId(req.user.sub);

    if (!driver) {
      return res.status(404).json({
        message: "Driver profile not found",
      });
    }

    return res.json({
      driverId: driver.id,
      isOnline: driver.isOnline ?? false,
      isAvailable: driver.isAvailable,
      latitude: driver.latitude ?? null,
      longitude: driver.longitude ?? null,
      lastLocationAt: driver.lastLocationAt ?? null,
    });
  };



  getDriverRatingSummary = async (
    req: Request,
    res: Response
  ) => {
    const driverId = req.params.id;

    if (
      !driverId ||
      Array.isArray(driverId)
    ) {
      return res.status(400).json({
        message: "Driver ID is required",
      });
    }

    const result =
      await this.service.getDriverRatingSummary(
        driverId
      );

    return res.json(result);
  };

  getNearbyDrivers = async (
    req: Request,
    res: Response
  ) => {
    const result = nearbyDriversQuerySchema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid nearby driver query",
        errors: result.error.flatten(),
      });
    }

    const {
      latitude,
      longitude,
      radiusKm,
      limit,
    } = result.data;

    const drivers = await this.service.getNearbyDrivers(
      latitude,
      longitude,
      radiusKm,
      limit
    );

    return res.json({
      latitude,
      longitude,
      radiusKm,
      count: drivers.length,
      drivers,
    });
  };

}
