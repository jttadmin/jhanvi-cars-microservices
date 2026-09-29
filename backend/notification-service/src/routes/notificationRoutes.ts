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

import {
  requireAuth
} from "../middlewares/auth.middleware";

const router = Router();

router.get(
  "/health",
  asyncHandler(notificationController.health)
);

router.get(
  "/notifications",
  requireAuth,
  asyncHandler(notificationController.getAll)
);

router.get(
  "/notifications/:id",
  requireAuth,
  asyncHandler(notificationController.getById)
);

router.post(
  "/notifications",
  requireInternalService,
  asyncHandler(notificationController.create)
);

router.put(
  "/notifications/:id",
  requireInternalService,
  asyncHandler(notificationController.update)
);

router.patch(
  "/notifications/:id/status",
  requireInternalService,
  asyncHandler(notificationController.updateStatus)
);

export default router;

