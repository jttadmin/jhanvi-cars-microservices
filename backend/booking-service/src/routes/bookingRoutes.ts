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
  requireAuth,
  requireInternalService
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
    requireInternalService,
    asyncHandler(
      controller.driverAccepted
    )
  );
  router.patch(
    "/internal/:id/driver-expired",
    requireInternalService,
    asyncHandler(
      controller.driverExpired
    )
  );
  router.patch(
    "/internal/:id/driver-rejected",
    requireInternalService,
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
    "/internal/drivers/:driverId/rating-summary",
    requireInternalService,
    asyncHandler(
      controller.getDriverRatingSummary
    )
  );

  router.get(
    "/internal/drivers/:driverId/earnings",
    requireInternalService,
    asyncHandler(
      controller.getDriverEarningsInternal
    )
  );

  router.get(
    "/internal/drivers/:driverId/history",
    requireInternalService,
    asyncHandler(
      controller.getDriverHistoryInternal
    )
  );

  router.post(
    "/:id/rating",
    asyncHandler(
      controller.createDriverRating
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
