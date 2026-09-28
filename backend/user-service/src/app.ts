import express, {
  type Express,
} from 'express';

import pino from 'pino';
import pinoHttp from 'pino-http';

import { getDatabase } from './config/database';

import {
  errorMiddleware,
} from './middleware/error.middleware';

import {
  requestIdMiddleware,
} from './middleware/request-id.middleware';

import {
  PostgresUserProfileRepository,
} from './repositories/user-profile.repository';

import {
  createHealthRouter,
} from './routes/health.routes';

import {
  createUserRouter,
} from './routes/user.routes';

import {
  UserProfileService,
} from './services/user-profile.service';

export interface AppDependencies {
  userProfileService?: UserProfileService;
  jwtSecret?: string;
}

export function createApp(
  dependencies: AppDependencies = {},
): Express {
  const app = express();

  const logger = pino({
    level:
      (process.env.NODE_ENV ?? 'development') === 'development'
        ? 'debug'
        : 'info',
  });

  app.use(
    requestIdMiddleware,
  );

  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({
        requestId: req.requestId,
      }),
    }),
  );

  app.use(express.json());

  app.use(
    createHealthRouter(),
  );

  const userProfileService =
    dependencies.userProfileService ??
    new UserProfileService(
      new PostgresUserProfileRepository(
        getDatabase(),
      ),
    );

  if (dependencies.jwtSecret) {
    app.use(
      createUserRouter(
        userProfileService,
        dependencies.jwtSecret,
      ),
    );
  }

  app.use(errorMiddleware);

  return app;
}
