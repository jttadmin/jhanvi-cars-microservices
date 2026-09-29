import {
  Router
} from "express";

import {
  VehicleController
} from "../controllers/vehicleController";

import {
  asyncHandler
} from "../middleware/asyncHandler";

import {
  requireInternalService
} from "../middleware/internalAuth";

export function createVehicleRoutes(
  controller: VehicleController
): Router {

  const router = Router();

  router.get(
    "/",
    requireInternalService,
    asyncHandler(
      controller.getAllVehicles
    )
  );

  router.get(
    "/:id",
    requireInternalService,
    asyncHandler(
      controller.getVehicleById
    )
  );

  router.post(
    "/",
    requireInternalService,
    asyncHandler(
      controller.createVehicle
    )
  );

  router.put(
    "/:id",
    requireInternalService,
    asyncHandler(
      controller.updateVehicle
    )
  );

  router.patch(
    "/:id/status",
    requireInternalService,
    asyncHandler(
      controller.updateVehicleStatus
    )
  );

  return router;
}
