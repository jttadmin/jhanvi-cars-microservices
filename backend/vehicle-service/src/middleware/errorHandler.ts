import {
  Request,
  Response,
  NextFunction
} from "express";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(err);

  if (err?.code === "23505") {
    const constraint = String(err?.constraint ?? "");

    if (constraint === "vehicles_driver_id_unique") {
      return res.status(409).json({
        message: "This driver is already assigned to another vehicle"
      });
    }

    if (constraint.includes("registration_number")) {
      return res.status(409).json({
        message: "A vehicle with this registration number already exists"
      });
    }

    return res.status(409).json({
      message: "Duplicate vehicle data"
    });
  }

  if (
    typeof err?.statusCode === "number" &&
    err.statusCode >= 400 &&
    err.statusCode < 600
  ) {
    return res.status(err.statusCode).json({
      message: err.message || "Request failed"
    });
  }

  return res.status(500).json({
    message: "Internal server error"
  });
}
