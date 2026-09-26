import { Router } from "express";

import {
  notificationController
} from "../controllers/notificationController";

import {
  asyncHandler
} from "../middlewares/asyncHandler";

import {
  requireInternalService
} from "../middlewares/internalAuth";

const router = Router();

router.get(
  "/health",
  asyncHandler(notificationController.health)
);

router.get(
  "/notifications",
  asyncHandler(notificationController.getAll)
);

router.get(
  "/notifications/:id",
  asyncHandler(notificationController.getById)
);

router.post(
  "/notifications",
  requireInternalService,
  asyncHandler(notificationController.create)
);

router.put(
  "/notifications/:id",
  asyncHandler(notificationController.update)
);

router.patch(
  "/notifications/:id/status",
  asyncHandler(notificationController.updateStatus)
);

export default router;
