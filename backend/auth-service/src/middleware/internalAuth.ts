import { NextFunction, Request, Response } from 'express';

export function requireInternalService(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.header('x-internal-service-token');
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!token || !expectedToken || token !== expectedToken) {
    res.status(403).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVICE_AUTH_REQUIRED',
        message: 'Internal service authentication required',
      },
    });
    return;
  }

  next();
}
