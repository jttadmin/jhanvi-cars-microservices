import { loadConfig } from './config.loader';
import type { AppConfig } from './config.types';

let env: AppConfig | undefined;

export async function initializeConfig(): Promise<AppConfig> {
  if (!env) {
    env = await loadConfig();
  }

  return env;
}

export function getConfig(): AppConfig {
  if (!env) {
    throw new Error('Configuration has not been initialized');
  }

  return env;
}
