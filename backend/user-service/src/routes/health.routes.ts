import {
  Router,
  type RequestHandler
} from 'express';

export function createHealthRouter(): Router {
  const router = Router();

  const healthHandler: RequestHandler = (
    _req,
    res
  ) => {
    res.status(200).json({
      status: 'ok',
      service:
        process.env.SERVICE_NAME ??
        'user-service'
    });
  };

  router.get('/health', healthHandler);

  return router;
}
