import express, { Express } from 'express';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger';
import { requestId } from './middleware/requestId';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';

export function createApp(serviceName = 'auth-service'): Express {
  const app = express();

  app.use(express.json());
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as unknown as { requestId: string }).requestId,
      customLogLevel: (_req, res) => (res.statusCode >= 500 ? 'error' : 'info'),
    }),
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: serviceName });
  });

  app.use('/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
