import express from "express";

import db from "./database";
import { DriverRepository } from "./repositories/driverRepository";
import { DriverService } from "./services/driverService";
import { DriverController } from "./controllers/driverController";
import { createDriverRoutes } from "./routes/driverRoutes";
import { DriverRideRequestRepository } from "./repositories/driverRideRequestRepository";
import { DriverRideRequestService } from "./services/driverRideRequestService";
import { DriverRideRequestController } from "./controllers/driverRideRequestController";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(express.json());

// Dependency wiring
const repository = new DriverRepository(db);
const service = new DriverService(repository);
const controller = new DriverController(service);

const rideRequestRepository =
  new DriverRideRequestRepository(db);

const rideRequestService =
  new DriverRideRequestService(
    rideRequestRepository
  );

const rideRequestController =
  new DriverRideRequestController(
    rideRequestService,
    service
  );

// Health check
app.get("/health", async (_req, res) => {
  try {
    await db.raw("SELECT 1");

    return res.json({
      service: "driver-service",
      status: "UP",
      database: "UP",
    });
  } catch {
    return res.status(503).json({
      service: "driver-service",
      status: "UP",
      database: "DOWN",
    });
  }
});

// Driver routes
app.use(
  "/drivers",
  createDriverRoutes(
    controller,
    rideRequestController
  )
);

// Centralized error handler
app.use(errorHandler);

// Automatically expire unanswered ride offers and notify Booking Service.
const RIDE_REQUEST_EXPIRY_POLL_MS = 5_000;
let expiryPollRunning = false;

const expiryPollTimer = setInterval(async () => {
  if (expiryPollRunning) {
    return;
  }

  expiryPollRunning = true;

  try {
    await rideRequestService.processExpiredRideRequests(100);
  } catch (error) {
    console.error("Ride-request expiry polling failed", error);
  } finally {
    expiryPollRunning = false;
  }
}, RIDE_REQUEST_EXPIRY_POLL_MS);

// Do not keep the process alive solely because of the polling timer.
expiryPollTimer.unref();

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`Driver service running on port ${PORT}`);
  console.log(
    `Ride-request expiry worker polling every ${RIDE_REQUEST_EXPIRY_POLL_MS}ms`
  );
});
