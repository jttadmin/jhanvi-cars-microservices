import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  sub?: string;
}

export function createAuthMiddleware(
  jwtSecret: string,
): RequestHandler {
  return (req, res, next) => {
    const authorization = req.header('authorization');

    if (!authorization) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header is required',
        },
      });

      return;
    }

    const [scheme, token] = authorization.split(' ');

    if (
      scheme?.toLowerCase() !== 'bearer' ||
      !token
    ) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Bearer token is required',
        },
      });

      return;
    }

    try {
      const decoded = jwt.verify(
        token,
        jwtSecret,
      ) as JwtPayload;

      if (
        typeof decoded.sub !== 'string' ||
        decoded.sub.trim() === ''
      ) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'JWT subject is missing',
          },
        });

        return;
      }

      req.user = {
        id: decoded.sub,
      };

      next();
    } catch {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired access token',
        },
      });
    }
  };
}
