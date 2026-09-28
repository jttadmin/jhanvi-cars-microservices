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
    asyncHandler(controller.getAllDrivers)
  );

  router.get(
    "/me",
    requireAuth,
    asyncHandler(controller.getOwnProfile)
  );
  router.get(
    "/:id",
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
