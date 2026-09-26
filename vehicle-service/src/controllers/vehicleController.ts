import {
  Request,
  Response
} from "express";

import {
  randomUUID
} from "crypto";

import {
  VehicleService
} from "../services/vehicleService";

import {
  createVehicleSchema,
  updateVehicleSchema,
  updateVehicleStatusSchema
} from "../types/vehicleSchema";

export class VehicleController {

  constructor(
    private service:
      VehicleService
  ) {}

  getAllVehicles =
    async (
      _req: Request,
      res: Response
    ) => {

      const vehicles =
        await this.service
          .getAllVehicles();

      return res.json(vehicles);
    };

  getVehicleById =
    async (
      req: Request,
      res: Response
    ) => {

      const id =
        String(req.params.id);

      const vehicle =
        await this.service
          .getVehicleById(id);

      if (!vehicle) {

        return res
          .status(404)
          .json({
            message:
              "Vehicle not found"
          });
      }

      return res.json(vehicle);
    };

  createVehicle =
    async (
      req: Request,
      res: Response
    ) => {

      const result =
        createVehicleSchema
          .safeParse(req.body);

      if (!result.success) {

        return res
          .status(400)
          .json({
            message:
              "Invalid vehicle data",

            errors:
              result.error.flatten()
          });
      }

      const vehicle =
        await this.service
          .createVehicle({

            id:
              randomUUID(),

            ...result.data
          });

      return res
        .status(201)
        .json(vehicle);
    };

  updateVehicle =
    async (
      req: Request,
      res: Response
    ) => {

      const result =
        updateVehicleSchema
          .safeParse(req.body);

      if (!result.success) {

        return res
          .status(400)
          .json({
            message:
              "Invalid vehicle data",

            errors:
              result.error.flatten()
          });
      }

      const id =
        String(req.params.id);

      const vehicle =
        await this.service
          .updateVehicle(
            id,
            result.data
          );

      if (!vehicle) {

        return res
          .status(404)
          .json({
            message:
              "Vehicle not found"
          });
      }

      return res.json(vehicle);
    };

  updateVehicleStatus =
    async (
      req: Request,
      res: Response
    ) => {

      const result =
        updateVehicleStatusSchema
          .safeParse(req.body);

      if (!result.success) {

        return res
          .status(400)
          .json({
            message:
              "Invalid vehicle status",

            errors:
              result.error.flatten()
          });
      }

      const id =
        String(req.params.id);

      const vehicle =
        await this.service
          .updateVehicleStatus(
            id,
            result.data.status
          );

      if (!vehicle) {

        return res
          .status(404)
          .json({
            message:
              "Vehicle not found"
          });
      }

      return res.json(vehicle);
    };
}
