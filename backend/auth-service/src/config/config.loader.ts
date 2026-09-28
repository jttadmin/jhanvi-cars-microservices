import 'dotenv/config';
import type { SignOptions } from 'jsonwebtoken';

import { runtimeConfigSchema, staticConfigSchema } from './config.schema';
import type { RuntimeConfig, StaticConfig } from './config.types';

function parseJwtExpiresIn(value: string): SignOptions['expiresIn'] {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (/^\d+(ms|s|m|h|d|w|y)$/.test(value)) {
    return value as SignOptions['expiresIn'];
  }

  throw new Error(
    `Invalid JWT_EXPIRES_IN value: ${value}. Expected values such as "1h", "30m", or "7d".`,
  );
}

function required(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required configuration: ${name}`);
  }

  return value;
}

export function loadStaticConfig(): StaticConfig {
  const config = {
    port: Number(process.env.PORT ?? 3001),
    serviceName: process.env.SERVICE_NAME ?? 'auth-service',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    dbSchema: process.env.DB_SCHEMA ?? 'auth_schema',
    authProvider: process.env.AUTH_PROVIDER ?? 'local',
    jwtExpiresIn: parseJwtExpiresIn(
      process.env.JWT_EXPIRES_IN ?? '1h',
    ),
    secretFilePath: process.env.SECRET_FILE_PATH || undefined,
  };

  return staticConfigSchema.parse(config) as StaticConfig;
}

export function loadFromEnvironment(): RuntimeConfig {
  const config = {
    ...loadStaticConfig(),
    databaseUrl: required('DATABASE_URL'),
    jwtSecret: required('JWT_SECRET'),
  };

  return runtimeConfigSchema.parse(config) as RuntimeConfig;
}