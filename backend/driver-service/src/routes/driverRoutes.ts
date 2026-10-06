import { Router } from "express";
import { DriverController } from "../controllers/driverController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireInternalService } from "../middleware/internalAuth";
import { requireAuth } from "../middleware/authMiddleware";

export function createDriverRoutes(
  controller: DriverController
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

  router.get(
    "/:id",
    requireInternalService,
    asyncHandler(controller.getDriverById)
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
