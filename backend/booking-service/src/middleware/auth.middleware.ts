import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type UserRole = "CUSTOMER" | "DRIVER" | "ADMIN";

export interface AuthUser {
  id: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
      internalService?: boolean;
    }
  }
}

function unauthorized(res: Response, message = "Unauthorized") {
  return res.status(401).json({ message });
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const internalToken = req.header("x-internal-service-token");

  if (
    internalToken &&
    process.env.INTERNAL_SERVICE_TOKEN &&
    internalToken === process.env.INTERNAL_SERVICE_TOKEN
  ) {
    req.internalService = true;
    return next();
  }

  const authorization = req.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return unauthorized(res, "Missing bearer token");
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return unauthorized(res, "Missing bearer token");
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error("JWT_SECRET is not configured");

    return res.status(500).json({
      message: "Authentication configuration error",
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof decoded.sub !== "string" ||
      !["CUSTOMER", "DRIVER", "ADMIN"].includes(String(decoded.role))
    ) {
      return unauthorized(res, "Invalid authentication token");
    }

    req.auth = {
      id: decoded.sub,
      role: decoded.role as UserRole,
    };

    return next();
  } catch {
    return unauthorized(res, "Invalid or expired token");
  }
}

export function requireInternalService(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.internalService) {
    return next();
  }

  return res.status(403).json({
    message: "Internal service authentication required",
  });
}
