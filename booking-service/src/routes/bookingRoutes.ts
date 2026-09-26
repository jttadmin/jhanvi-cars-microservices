import {
  Router
} from "express";

import {
  BookingController
} from "../controllers/bookingController";

import {
  asyncHandler
} from "../middleware/asyncHandler";

import {
  requireAuth
} from "../middleware/auth.middleware";

export function createBookingRoutes(
  controller: BookingController
): Router {

  const router =
    Router();

  router.use(
    requireAuth
  );

  router.get(
    "/",
    asyncHandler(
      controller.getAllBookings
    )
  );

  router.get(
    "/:id",
    asyncHandler(
      controller.getBookingById
    )
  );

  router.post(
    "/",
    asyncHandler(
      controller.createBooking
    )
  );

  router.put(
    "/:id",
    asyncHandler(
      controller.updateBooking
    )
  );
  router.patch(
    "/:id/accept",
    asyncHandler(
      controller.acceptBooking
    )
  );
  router.patch(
    "/:id/status",
    asyncHandler(
      controller.updateBookingStatus
    )
  );

  return router;
}
