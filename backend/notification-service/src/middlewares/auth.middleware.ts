import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type UserRole =
  | "CUSTOMER"
  | "DRIVER"
  | "ADMIN";

export interface AuthUser {
  id: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authorization =
    req.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Missing bearer token"
    });
  }

  const token =
    authorization
      .slice("Bearer ".length)
      .trim();

  if (!token) {
    return res.status(401).json({
      message: "Missing bearer token"
    });
  }

  const jwtSecret =
    process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error(
      "JWT_SECRET is not configured"
    );

    return res.status(500).json({
      message:
        "Authentication configuration error"
    });
  }

  try {
    const decoded =
      jwt.verify(
        token,
        jwtSecret
      );

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof decoded.sub !== "string" ||
      ![
        "CUSTOMER",
        "DRIVER",
        "ADMIN"
      ].includes(
        String(decoded.role)
      )
    ) {
      return res.status(401).json({
        message:
          "Invalid authentication token"
      });
    }

    req.auth = {
      id: decoded.sub,
      role:
        decoded.role as UserRole
    };

    return next();

  } catch {
    return res.status(401).json({
      message:
        "Invalid or expired token"
    });
  }
}
