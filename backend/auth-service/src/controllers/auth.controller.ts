import { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../validators/auth.validator';
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



  async getInternalUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id;

      if (
        !userId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
      ) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_USER_ID', message: 'A valid UUID user ID is required' },
        });
        return;
      }

      const user = await authService.getById(userId);
      res.status(200).json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new UnauthorizedError('Not authenticated');
      }

      const input = updateProfileSchema.parse(req.body);
      const user = await authService.updateProfile(req.auth.sub, input);

      res.status(200).json({ success: true, data: { user } });
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
