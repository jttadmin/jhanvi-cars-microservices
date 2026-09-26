import { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { loginSchema, registerSchema } from '../validators/auth.validator';
import { UnauthorizedError } from '../errors/AppError';

// Controllers only: parse/validate input, call the service, shape the
// HTTP response. No SQL, no business rules here.
export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const input = registerSchema.parse(req.body);
      const result = await authService.register(input);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input = loginSchema.parse(req.body);
      const result = await authService.login(input);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new UnauthorizedError('Not authenticated');
      }
      const user = await authService.getById(req.auth.sub);
      res.status(200).json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },
};
