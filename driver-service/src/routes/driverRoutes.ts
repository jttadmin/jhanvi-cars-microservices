import { Router } from "express";
import { DriverController } from "../controllers/driverController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireInternalService } from "../middleware/internalAuth";

export function createDriverRoutes(
  controller: DriverController
): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(controller.getAllDrivers)
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
    "/:id/status",
    requireInternalService,
    asyncHandler(controller.updateDriverStatus)
  );

  return router;
}
