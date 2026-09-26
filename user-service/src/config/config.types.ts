export interface AppConfig {
  port: number;
  serviceName: string;
  nodeEnv: string;
  dbSchema: string;
  databaseUrl: string;
  jwtSecret: string;
  authServiceUrl: string;
}
