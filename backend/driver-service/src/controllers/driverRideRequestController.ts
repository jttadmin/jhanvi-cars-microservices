import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { DriverRideRequestService } from "../services/driverRideRequestService";
import { DriverService } from "../services/driverService";

export class DriverRideRequestController {
  constructor(
    private readonly rideRequestService: DriverRideRequestService,
    private readonly driverService: DriverService
  ) {}

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const request =
        await this.rideRequestService.createRideRequest(req.body);

      res.status(201).json(request);
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to create ride request",
      });
    }
  }

  getDriverIdsByBookingId = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    const bookingId = String(req.params.bookingId);

    if (!bookingId) {
      res.status(400).json({ message: "bookingId is required" });
      return;
    }

    try {
      const driverIds =
        await this.rideRequestService.getDriverIdsByBookingId(bookingId);

      res.json({
        bookingId,
        driverIds,
      });
    } catch (error) {
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to get ride-request history",
      });
    }
  };

  getMine = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const driver = await this.driverService.getDriverByUserId(
        req.user.sub
      );

      if (!driver) {
        res.status(404).json({ message: "Driver not found" });
        return;
      }

      const requests =
        await this.rideRequestService.getDriverRideRequests(driver.id);

      res.json(requests);
    } catch (error) {
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to get ride requests",
      });
    }
  }

  accept = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const driver = await this.driverService.getDriverByUserId(
        req.user.sub
      );

      if (!driver) {
        res.status(404).json({ message: "Driver not found" });
        return;
      }

      const id = String(req.params.id);

      const request =
        await this.rideRequestService.acceptRideRequest(
          id,
          driver.id
        );

      res.json(request);
    } catch (error) {
      res.status(409).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to accept ride request",
      });
    }
  }

  expire = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const id = String(req.params.id);

      const request =
        await this.rideRequestService.expireRideRequest(id);

      if (!request) {
        res.status(404).json({
          message: "Ride request is not offered or has not expired",
        });
        return;
      }

      res.json(request);
    } catch (error) {
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to expire ride request",
      });
    }
  }

  reject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const driver = await this.driverService.getDriverByUserId(
        req.user.sub
      );

      if (!driver) {
        res.status(404).json({ message: "Driver not found" });
        return;
      }

      const id = String(req.params.id);

      const request =
        await this.rideRequestService.rejectRideRequest(
          id,
          driver.id
        );

      res.json(request);
    } catch (error) {
      res.status(409).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to reject ride request",
      });
    }
  }
}
