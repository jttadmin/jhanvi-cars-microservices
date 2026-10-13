import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(err);

  // PostgreSQL unique constraint violation
  if (err?.code === "23505") {
    return res.status(409).json({
      message: "Duplicate driver data",
      detail: err.detail,
    });
  }

  if (
    typeof err?.statusCode === "number" &&
    err.statusCode >= 400 &&
    err.statusCode < 600
  ) {
    return res.status(err.statusCode).json({
      message: err.message || "Request failed",
      ...(typeof err.code === "string" ? { code: err.code } : {}),
    });
  }

  return res.status(500).json({
    message: "Internal server error",
  });
}
