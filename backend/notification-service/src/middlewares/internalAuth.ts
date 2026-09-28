import { NextFunction, Request, Response } from "express";

export function requireInternalService(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token =
    req.header("x-internal-service-token");

  if (
    !token ||
    !process.env.INTERNAL_SERVICE_TOKEN ||
    token !== process.env.INTERNAL_SERVICE_TOKEN
  ) {
    return res.status(403).json({
      message: "Internal service authentication required"
    });
  }

  return next();
}
