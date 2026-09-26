import express from "express";

import db from "./database";

import {
  VehicleRepository
} from "./repositories/vehicleRepository";

import {
  VehicleService
} from "./services/vehicleService";

import {
  VehicleController
} from "./controllers/vehicleController";

import {
  createVehicleRoutes
} from "./routes/vehicleRoutes";

import {
  errorHandler
} from "./middleware/errorHandler";

const app =
  express();

app.use(
  express.json()
);

const repository =
  new VehicleRepository(db);

const service =
  new VehicleService(
    repository
  );

const controller =
  new VehicleController(
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
          "vehicle-service",

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
            "vehicle-service",

          status:
            "UP",

          database:
            "DOWN"
        });
    }
  }
);

app.use(
  "/vehicles",
  createVehicleRoutes(
    controller
  )
);

app.use(
  errorHandler
);

const PORT =
  process.env.PORT ||
  3005;

app.listen(
  PORT,
  () => {

    console.log(
      `Vehicle service running on port ${PORT}`
    );
  }
);
