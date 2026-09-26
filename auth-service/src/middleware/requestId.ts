import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Augment Express's Request type so `req.requestId` is typed everywhere.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  // The gateway will normally set this header; if a service is hit
  // directly (e.g. in dev) we generate one so logs still correlate.
  const incoming = req.header('x-request-id');
  req.requestId = incoming ?? uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
}
