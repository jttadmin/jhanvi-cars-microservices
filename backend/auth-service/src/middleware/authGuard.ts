import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors/AppError';
import { tokenProvider, TokenPayload } from '../services/token.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

// In production topology, the API Gateway verifies the token once at the
// edge and forwards identity via trusted headers. This guard exists so
// auth-service's own protected routes (like /auth/me) also work when
// called directly, e.g. in local dev or tests.
export async function authGuard(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  const token = header.slice('Bearer '.length);
  req.auth = await tokenProvider.verify(token);
  next();
}
