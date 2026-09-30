import { Router } from "express";

import {
  paymentController
} from "../controllers/paymentController";

import {
  asyncHandler
} from "../middlewares/asyncHandler";

import {
  requireAuth
} from "../middlewares/auth.middleware";

const router = Router();

router.get(
  "/health",
  asyncHandler(
    paymentController.health
  )
);

router.use(
  requireAuth
);

router.get(
  "/payments",
  asyncHandler(
    paymentController.getAll
  )
);

router.get(
  "/payments/booking/:bookingId",
  asyncHandler(
    paymentController.getByBookingId
  )
);

router.get(
  "/payments/:id",
  asyncHandler(
    paymentController.getById
  )
);

router.post(
  "/payments",
  asyncHandler(
    paymentController.create
  )
);

router.post(
  "/payments/:id/razorpay-order",
  asyncHandler(
    paymentController.createRazorpayOrder
  )
);

router.post(
  "/payments/:id/razorpay-verify",
  asyncHandler(
    paymentController.verifyRazorpayPayment
  )
);

router.put(
  "/payments/:id",
  asyncHandler(
    paymentController.update
  )
);

router.patch(
  "/payments/:id/status",
  asyncHandler(
    paymentController.updateStatus
  )
);

export default router;
