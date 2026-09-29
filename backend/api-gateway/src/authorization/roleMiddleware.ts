import { NextFunction, Request, Response } from "express";
import { UserRole } from "../auth/tokenVerifier";

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json({
        message: "Forbidden",
      });
      return;
    }

    next();
  };
}
