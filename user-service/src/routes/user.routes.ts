import {
  Router,
  type RequestHandler,
} from 'express';

import {
  createAuthMiddleware,
} from '../middleware/auth.middleware';

import { UserProfileService } from '../services/user-profile.service';

import {
  updateUserProfileSchema,
} from '../validation/user-profile.schema';

export function createUserRouter(
  service: UserProfileService,
  jwtSecret: string,
): Router {
  const router = Router();

  const requireAuth =
    createAuthMiddleware(jwtSecret);

  const getMe: RequestHandler = async (
    req,
    res,
    next,
  ) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message:
              'Authenticated user is required',
          },
        });

        return;
      }

      const profile =
        await service.getMyProfile(userId);

      if (!profile) {
        res.status(404).json({
          error: {
            code: 'PROFILE_NOT_FOUND',
            message:
              'User profile not found',
          },
        });

        return;
      }

      res.status(200).json({
        user: {
          id: profile.userId,
          displayName: profile.displayName,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  const updateMe: RequestHandler = async (
    req,
    res,
    next,
  ) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message:
              'Authenticated user is required',
          },
        });

        return;
      }

      const input =
        updateUserProfileSchema.parse(
          req.body,
        );

      const profile =
        await service.updateMyProfile(
          userId,
          input,
        );

      res.status(200).json({
        user: {
          id: profile.userId,
          displayName: profile.displayName,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  router.get(
    '/users/me',
    requireAuth,
    getMe,
  );

  router.patch(
    '/users/me',
    requireAuth,
    updateMe,
  );

  return router;
}
