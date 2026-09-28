import 'dotenv/config';

import { configSchema } from './config.schema';
import type { AppConfig } from './config.types';
import { loadSecretsFromFile } from './secret-file.source';

function required(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required configuration: ${name}`);
  }

  return value;
}

export async function loadConfig(): Promise<AppConfig> {
  const secretFilePath = process.env.SECRET_FILE_PATH;

  let jwtSecret: string;

  if (secretFilePath && secretFilePath.trim() !== '') {
    const secrets = await loadSecretsFromFile(
      secretFilePath,
    );

    jwtSecret = secrets.jwtSecret;
  } else {
    jwtSecret = required('JWT_SECRET');
  }

  const config = {
    port: Number(process.env.PORT ?? 3002),
    serviceName: process.env.SERVICE_NAME ?? 'user-service',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    dbSchema: process.env.DB_SCHEMA ?? 'user_schema',
    databaseUrl: required('DATABASE_URL'),
    jwtSecret,
    authServiceUrl:
      process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001',
  };

  return configSchema.parse(config);
}
