import { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler =
  (err, _req, res, _next) => {

    if (err?.code === "23505") {
      return res.status(409).json({
        message: "Duplicate payment data",
        detail: err.detail ?? "Unique payment field already exists."
      });
    }

    const statusCode = Number(err?.statusCode) || 500;

    return res.status(statusCode).json({
      message:
        statusCode === 500
          ? "Internal server error"
          : err.message
    });
  };
