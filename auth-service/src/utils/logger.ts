import pino from 'pino';

// Structured logger. Every log line carries `service` so that once this
// runs alongside the other services, logs can be filtered/correlated
// easily (and later shipped to Loki/ELK without any code changes).
const nodeEnv = process.env.NODE_ENV ?? 'development';
const serviceName = process.env.SERVICE_NAME ?? 'auth-service';

export const logger = pino({
  level: nodeEnv === 'production' ? 'info' : 'debug',
  base: { service: serviceName },
  timestamp: pino.stdTimeFunctions.isoTime,
});
