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
  FareController
} from "../controllers/fareController";

import {
  requireAuth,
  requireInternalService
} from "../middleware/auth.middleware";

export function createBookingRoutes(
  controller: BookingController,
  fareController?: FareController
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

  if (fareController) {
    // Must be registered before "/:id".
    router.get(
      "/fare-rules",
      asyncHandler(fareController.getRules)
    );

    router.put(
      "/fare-rules/:vehicleType",
      asyncHandler(fareController.updateRule)
    );

    router.post(
      "/fare-quote",
      asyncHandler(fareController.quote)
    );
  }

  router.get(
    "/:id/tracking",
    asyncHandler(
      controller.getRideTracking
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
