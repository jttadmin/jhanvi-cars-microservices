import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

export const requestIdMiddleware: RequestHandler = (
  req,
  res,
  next
) => {
  const incomingRequestId = req.header('x-request-id');

  const requestId =
    incomingRequestId?.trim() || randomUUID();

  req.requestId = requestId;

  res.setHeader('x-request-id', requestId);

  next();
};
