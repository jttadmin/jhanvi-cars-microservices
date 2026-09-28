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

  if (
    typeof err?.statusCode === "number"
  ) {
    return res
      .status(err.statusCode)
      .json({
        message: err.message
      });
  }

  if (
    err?.code === "23505"
  ) {
    return res
      .status(409)
      .json({
        message:
          "Duplicate booking data",
        detail:
          err.detail
      });
  }

  return res
    .status(500)
    .json({
      message:
        "Internal server error"
    });
}
