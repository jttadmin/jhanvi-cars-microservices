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

  router.patch(
    "/internal/:id/driver-accepted",
    asyncHandler(
      controller.driverAccepted
    )
  );
  router.patch(
    "/internal/:id/driver-expired",
    asyncHandler(
      controller.driverExpired
    )
  );
  router.patch(
    "/internal/:id/driver-rejected",
    asyncHandler(
      controller.driverRejected
    )
  );

  router.get(
    "/",
    asyncHandler(
      controller.getAllBookings
    )
  );

  router.get(
    "/me/earnings",
    asyncHandler(
      controller.getDriverEarnings
    )
  );

  router.get(
    "/me/history",
    asyncHandler(
      controller.getDriverHistory
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
    "/:id/start",
    asyncHandler(
      controller.startBooking
    )
  );

  router.patch(
    "/:id/complete",
    asyncHandler(
      controller.completeBooking
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
