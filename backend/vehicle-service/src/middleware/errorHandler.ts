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
    err?.code === "23505"
  ) {

    return res
      .status(409)
      .json({
        message:
          "Duplicate vehicle data",

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
