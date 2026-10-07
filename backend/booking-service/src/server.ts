import express from "express";

import db from "./database";

import {
  BookingRepository
} from "./repositories/bookingRepository";

import {
  DriverRatingRepository
} from "./repositories/driverRatingRepository";

import {
  BookingService
} from "./services/bookingService";

import {
  DriverRatingService
} from "./services/driverRatingService";

import {
  BookingController
} from "./controllers/bookingController";

import {
  createBookingRoutes
} from "./routes/bookingRoutes";

import {
  errorHandler
} from "./middleware/errorHandler";

const app =
  express();

app.use(
  express.json()
);

const repository =
  new BookingRepository(db);

const service =
  new BookingService(
    repository
  );

const ratingRepository =
  new DriverRatingRepository(
    db
  );

const ratingService =
  new DriverRatingService(
    ratingRepository,
    repository
  );

const controller =
  new BookingController(
    service,
    ratingService
  );

app.get(
  "/health",
  async (
    _req,
    res
  ) => {

    try {

      await db.raw(
        "SELECT 1"
      );

      return res.json({
        service:
          "booking-service",

        status:
          "UP",

        database:
          "UP"
      });

    } catch {

      return res
        .status(503)
        .json({

          service:
            "booking-service",

          status:
            "UP",

          database:
            "DOWN"
        });
    }
  }
);

app.use(
  "/bookings",
  createBookingRoutes(
    controller
  )
);

app.use(
  errorHandler
);

const PORT =
  process.env.PORT ||
  3004;

app.listen(
  PORT,
  () => {

    console.log(
      `Booking service running on port ${PORT}`
    );
  }
);
