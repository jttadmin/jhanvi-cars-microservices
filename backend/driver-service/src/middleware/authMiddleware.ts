import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    role: "CUSTOMER" | "DRIVER" | "ADMIN";
  };
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Missing or invalid authorization header",
    });
  }

  const token = authorization.substring("Bearer ".length);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({
      message: "JWT secret is not configured",
    });
  }

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string"
    ) {
      return res.status(401).json({
        message: "Invalid token payload",
      });
    }

    req.user = {
      sub: payload.sub,
      role: payload.role as "CUSTOMER" | "DRIVER" | "ADMIN",
    };

    return next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}
