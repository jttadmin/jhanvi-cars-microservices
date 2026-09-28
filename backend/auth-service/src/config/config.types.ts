import type { SignOptions } from 'jsonwebtoken';

export interface StaticConfig {
  port: number;
  serviceName: string;
  nodeEnv: string;
  dbSchema: string;
  authProvider: string;
  jwtExpiresIn: SignOptions['expiresIn'];
  secretFilePath?: string;
}

export interface SecretConfig {
  databaseUrl: string;
  jwtSecret: string;
}

export interface RuntimeConfig extends StaticConfig, SecretConfig {}