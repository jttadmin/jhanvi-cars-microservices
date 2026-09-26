import express from "express";

import db from "./database";

import {
  BookingRepository
} from "./repositories/bookingRepository";

import {
  BookingService
} from "./services/bookingService";

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

const controller =
  new BookingController(
    service
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
