import { createApp } from './app';
import {
  getRuntime,
  initializeRuntime,
} from './config/db';
import { logger } from './utils/logger';

async function start(): Promise<void> {
  const runtime = await initializeRuntime();

  await runtime.initialize();

  const config = getRuntime().configManager.current();
  const app = createApp(config.serviceName);

  const server = app.listen(config.port, () => {
    logger.info(`${config.serviceName} listening on port ${config.port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down`);

    server.close(async () => {
      try {
        await getRuntime().shutdown();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Shutdown failed');
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

void start().catch((error) => {
  logger.error({ error }, 'Failed to start auth service');
  process.exit(1);
});