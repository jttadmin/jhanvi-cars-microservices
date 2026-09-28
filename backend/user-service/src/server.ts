import {
  closeDatabase,
  initializeDatabase,
} from './config/database';

import {
  initializeConfig,
} from './config/env';

import { createApp } from './app';

async function bootstrap(): Promise<void> {
  const config = await initializeConfig();

  await initializeDatabase(config);

  const app = createApp({
    jwtSecret: config.jwtSecret,
  });

  const server = app.listen(
    config.port,
    () => {
      console.log(
        `${config.serviceName} listening on port ${config.port}`,
      );
    },
  );

  const shutdown = async (
    signal: string,
  ): Promise<void> => {
    console.log(
      `Received ${signal}, shutting down...`,
    );

    server.close(async () => {
      try {
        await closeDatabase();
        process.exit(0);
      } catch (error) {
        console.error(
          'Failed during shutdown:',
          error,
        );

        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

bootstrap().catch((error) => {
  console.error(
    'Failed to start user-service:',
    error,
  );

  process.exit(1);
});
