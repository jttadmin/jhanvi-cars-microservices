import type { RuntimeConfig, SecretConfig } from './config.types';

type ConfigListener = (
  current: RuntimeConfig,
  previous: RuntimeConfig,
) => void | Promise<void>;

export class ConfigManager {
  private currentConfig: RuntimeConfig;
  private readonly listeners = new Set<ConfigListener>();

  constructor(initialConfig: RuntimeConfig) {
    this.currentConfig = initialConfig;
  }

  current(): RuntimeConfig {
    return this.currentConfig;
  }

  subscribe(listener: ConfigListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async updateSecrets(secrets: SecretConfig): Promise<void> {
    const previous = this.currentConfig;

    const next: RuntimeConfig = {
      ...previous,
      ...secrets,
    };

    this.currentConfig = next;

    try {
      for (const listener of this.listeners) {
        await listener(next, previous);
      }
    } catch (error) {
      this.currentConfig = previous;
      throw error;
    }
  }
}