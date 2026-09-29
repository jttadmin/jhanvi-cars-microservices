import { NextFunction, Request, Response } from "express";
import { AuthenticatedUser, TokenVerifier } from "./tokenVerifier";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

export function createAuthMiddleware(tokenVerifier: TokenVerifier) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const header = req.header("authorization");

      if (!header?.startsWith("Bearer ")) {
        res.status(401).json({
          message: "Missing bearer token",
        });
        return;
      }

      const token = header.slice("Bearer ".length).trim();

      if (!token) {
        res.status(401).json({
          message: "Missing bearer token",
        });
        return;
      }

      const user = tokenVerifier.verify(token);

      // Never trust identity headers supplied by the client.
      delete req.headers["x-user-id"];
      delete req.headers["x-user-role"];

      req.headers["x-user-id"] = user.sub;
      req.headers["x-user-role"] = user.role;

      req.auth = user;

      next();
    } catch {
      res.status(401).json({
        message: "Invalid or expired token",
      });
    }
  };
}
