import { Router } from "express";
import { DriverController } from "../controllers/driverController";
import { DriverRideRequestController } from "../controllers/driverRideRequestController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireInternalService } from "../middleware/internalAuth";
import { requireAuth } from "../middleware/authMiddleware";

export function createDriverRoutes(
  controller: DriverController,
  rideRequestController: DriverRideRequestController
): Router {
  const router = Router();

  router.get(
    "/",
    requireInternalService,
    asyncHandler(controller.getAllDrivers)
  );

  router.get(
    "/me",
    requireAuth,
    asyncHandler(controller.getOwnProfile)
  );

  router.get(
    "/me/history",
    requireAuth,
    asyncHandler(controller.getOwnHistory)
  );

  router.get(
    "/me/presence",
    requireAuth,
    asyncHandler(controller.getOwnPresence)
  );

  router.patch(
    "/me/online",
    requireAuth,
    asyncHandler(controller.updateOwnOnline)
  );

  router.patch(
    "/me/location",
    requireAuth,
    asyncHandler(controller.updateOwnLocation)
  );

  /*
   * Nearby driver discovery
   * Internal service only.
   */
  router.get(
    "/nearby",
    requireInternalService,
    asyncHandler(controller.getNearbyDrivers)
  );

  /*
   * Ride requests
   *
   * Booking Service creates offers internally.
   * Driver accepts/rejects using authenticated driver JWT.
   */
  router.post(
    "/ride-requests",
    requireInternalService,
    asyncHandler(rideRequestController.create)
  );

  router.get(
    "/ride-requests/booking/:bookingId/drivers",
    requireInternalService,
    asyncHandler(
      rideRequestController.getDriverIdsByBookingId
    )
  );

  router.get(
    "/me/ride-requests",
    requireAuth,
    asyncHandler(rideRequestController.getMine)
  );

  router.patch(
    "/me/ride-requests/:id/accept",
    requireAuth,
    asyncHandler(rideRequestController.accept)
  );

  router.patch(
    "/ride-requests/:id/expire",
    requireInternalService,
    asyncHandler(rideRequestController.expire)
  );

  router.patch(
    "/me/ride-requests/:id/reject",
    requireAuth,
    asyncHandler(rideRequestController.reject)
  );

  router.get(
    "/:id",
    requireInternalService,
    asyncHandler(controller.getDriverById)
  );

  router.get(
    "/:id/rating-summary",
    requireInternalService,
    asyncHandler(controller.getDriverRatingSummary)
  );

  router.post(
    "/",
    requireInternalService,
    asyncHandler(controller.createDriver)
  );

  router.put(
    "/:id",
    requireInternalService,
    asyncHandler(controller.updateDriver)
  );

  router.patch(
    "/me/status",
    requireAuth,
    asyncHandler(controller.updateOwnStatus)
  );

  router.patch(
    "/:id/status",
    requireInternalService,
    asyncHandler(controller.updateDriverStatus)
  );

  return router;
}
