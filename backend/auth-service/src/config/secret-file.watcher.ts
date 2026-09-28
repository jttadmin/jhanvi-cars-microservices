import { watch, type FSWatcher } from 'node:fs';

import { loadSecretsFromFile } from './secret-file.source';
import { ConfigManager } from './config.manager';

export interface SecretFileWatcherOptions {
  debounceMs?: number;
}

export class SecretFileWatcher {
  private readonly filePath: string;
  private readonly configManager: ConfigManager;
  private readonly debounceMs: number;

  private watcher?: FSWatcher;
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private reloadInProgress = false;
  private reloadPending = false;

  constructor(
    filePath: string,
    configManager: ConfigManager,
    options: SecretFileWatcherOptions = {},
  ) {
    this.filePath = filePath;
    this.configManager = configManager;
    this.debounceMs = options.debounceMs ?? 250;
  }

  start(): void {
    if (this.watcher) {
      return;
    }

    this.stopped = false;

    this.watcher = watch(this.filePath, () => {
      this.scheduleReload();
    });
  }

  async reloadNow(): Promise<void> {
    await this.reload();
  }

  stop(): void {
    this.stopped = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    this.watcher?.close();
    this.watcher = undefined;
  }

  private scheduleReload(): void {
    if (this.stopped) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.reload();
    }, this.debounceMs);
  }

  private async reload(): Promise<void> {
    if (this.stopped) {
      return;
    }

    if (this.reloadInProgress) {
      this.reloadPending = true;
      return;
    }

    this.reloadInProgress = true;

    try {
      const secrets = await loadSecretsFromFile(this.filePath);

      await this.configManager.updateSecrets(secrets);
    } catch (error) {
      // Keep the currently active configuration.
      // The next filesystem event can trigger another attempt.
      console.error('Failed to reload secret file:', error);
    } finally {
      this.reloadInProgress = false;

      if (this.reloadPending) {
        this.reloadPending = false;
        this.scheduleReload();
      }
    }
  }
}