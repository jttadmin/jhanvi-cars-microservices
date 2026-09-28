import { ConfigManager } from './config.manager';
import { DatabaseManager } from './database.manager';
import {
  loadFromEnvironment,
  loadStaticConfig,
} from './config.loader';
import { loadSecretsFromFile } from './secret-file.source';
import { SecretFileWatcher } from './secret-file.watcher';
import type { RuntimeConfig } from './config.types';
import {
  initializeTokenProvider,
  rotateTokenSecret,
} from '../services/token.service';

export interface RuntimeOptions {
  secretFilePath?: string;
  secretFileDebounceMs?: number;
}

export class AppRuntime {
  readonly configManager: ConfigManager;
  readonly databaseManager: DatabaseManager;

  private readonly secretFileWatcher?: SecretFileWatcher;

  constructor(
    initialConfig: RuntimeConfig,
    options: RuntimeOptions = {},
  ) {
    this.configManager = new ConfigManager(initialConfig);
    this.databaseManager = new DatabaseManager();

    initializeTokenProvider(initialConfig);

    this.configManager.subscribe(async (next, previous) => {
      if (next.databaseUrl !== previous.databaseUrl) {
        await this.databaseManager.rotate(next);
      }

      if (next.jwtSecret !== previous.jwtSecret) {
        console.log(
          'JWT secret change detected — rotating token secret',
        );

        rotateTokenSecret(
          next.jwtSecret,
          next.databaseUrl,
        );

        console.log(
          'JWT token secret rotation completed',
        );
      }
    });

    if (options.secretFilePath) {
      this.secretFileWatcher = new SecretFileWatcher(
        options.secretFilePath,
        this.configManager,
        {
          debounceMs: options.secretFileDebounceMs,
        },
      );
    }
  }

  static async create(): Promise<AppRuntime> {
    const staticConfig = loadStaticConfig();

    let initialConfig: RuntimeConfig;

    if (staticConfig.secretFilePath) {
      const secrets = await loadSecretsFromFile(
        staticConfig.secretFilePath,
      );

      initialConfig = {
        ...staticConfig,
        ...secrets,
      };
    } else {
      initialConfig = loadFromEnvironment();
    }

    return new AppRuntime(initialConfig, {
      secretFilePath: staticConfig.secretFilePath,
    });
  }

  async initialize(): Promise<void> {
    await this.databaseManager.initialize(
      this.configManager.current(),
    );

    this.secretFileWatcher?.start();
  }

  async shutdown(): Promise<void> {
    this.secretFileWatcher?.stop();
    await this.databaseManager.close();
  }
}
