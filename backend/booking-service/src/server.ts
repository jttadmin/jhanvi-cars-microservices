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
import { FareRuleRepository } from "./repositories/fareRuleRepository";
import { FareService } from "./services/fareService";
import { FareController } from "./controllers/fareController";

const app =
  express();

app.use(
  express.json()
);

const repository =
  new BookingRepository(db);

const fareService =
  new FareService(
    new FareRuleRepository(db)
  );

const service =
  new BookingService(
    repository,
    fareService
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

const fareController =
  new FareController(fareService);

// Public: current fare rates (no auth) so estimates work before login.
app.get(
  "/bookings/fare-rules",
  (req, res, next) =>
    fareController.getRules(req, res).catch(next)
);

app.use(
  "/bookings",
  createBookingRoutes(
    controller,
    fareController
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
